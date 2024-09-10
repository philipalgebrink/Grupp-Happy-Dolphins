// Ladda AWS SDK
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.createBooking = async (event) => {
  const body = JSON.parse(event.body);
  const guests = body.guests;
  const rooms = body.rooms;
  const name = body.name;
  const email = body.email; // Lägg till namn

  // Kontrollera att namn är angivet
  if (!name) {
      return {
          statusCode: 400,
          body: JSON.stringify({ message: "Name is required" })
      };
  }

  const roomTypes = {
      "single": { capacity: 1, price: 500 },
      "double": { capacity: 2, price: 1000 },
      "suite": { capacity: 3, price: 1500 }
  };

  let totalRooms = 0;
  let totalPrice = 0;

  rooms.forEach(room => {
      const roomInfo = roomTypes[room.type];
      if (roomInfo) {
          totalRooms += room.quantity;
          totalPrice += roomInfo.price * room.quantity;
      }
  });

  if (totalRooms === 0) {
      return {
          statusCode: 400,
          body: JSON.stringify({ message: "No rooms specified in booking" })
      };
  }

  // Hämta aktuellt antal bokade rum
  const bookingParams = {
      TableName: 'BookingTable',
      ProjectionExpression: 'rooms'
  };

  let currentTotalRooms = 0;
  try {
      const data = await dynamodb.scan(bookingParams).promise();
      data.Items.forEach(item => {
          item.rooms.forEach(room => {
              currentTotalRooms += room.quantity;
          });
      });

      if (currentTotalRooms + totalRooms > 20) {
          return {
              statusCode: 400,
              body: JSON.stringify({ message: "Cannot book more than 20 rooms in total" })
          };
      }
  } catch (error) {
      console.error('Error fetching current bookings:', error);
      return {
          statusCode: 500,
          body: JSON.stringify({ message: "Error fetching current bookings", error: error.message })
      };
  }

  // Skapa bokningen om kontrollen passerar
  const bookingId = Date.now().toString();
  const params = {
      TableName: 'BookingTable',
      Item: {
          bookingId: bookingId,
          name: name, // Lägg till namn
          email: email,
          guests: guests,
          rooms: rooms,
          totalPrice: totalPrice
      }
  };

  try {
      await dynamodb.put(params).promise();
      return {
          statusCode: 200,
          body: JSON.stringify({
              message: "Booking successful",
              name: name,
              email: email,
              bookingId: bookingId,
              totalPrice: totalPrice
          })
      };
  } catch (error) {
      return {
          statusCode: 500,
          body: JSON.stringify({ message: "Error saving booking", error: error.message })
      };
  }
};

exports.listAllBookings = async (event) => {
  const params = {
      TableName: 'BookingTable' // Byt ut mot din faktiska tabellnamn
  };

  try {
      // Skanna hela tabellen
      const data = await dynamodb.scan(params).promise();
      return {
          statusCode: 200,
          body: JSON.stringify({
              message: "Bookings fetched successfully",
              bookings: data.Items // Items är bokningarna som hämtats från tabellen
          }),
          headers: {
              'Content-Type': 'application/json'
          }
      };
  } catch (error) {
      console.error('Error fetching bookings:', error);
      return {
          statusCode: 500,
          body: JSON.stringify({
              message: "Error fetching bookings",
              error: error.message
          }),
          headers: {
              'Content-Type': 'application/json'
          }
      };
  }
};

exports.listRooms = async (event) => {
  const roomTypes = {
    "single": { capacity: 1, price: 500 },
    "double": { capacity: 2, price: 1000 },
    "suite": { capacity: 3, price: 1500 }
};
  try {
      // Returnera information om rumstyper
      return {
          statusCode: 200,
          body: JSON.stringify({
              message: "Room types fetched successfully",
              roomTypes: roomTypes
          }),
          headers: {
              'Content-Type': 'application/json'
          }
      };
  } catch (error) {
      console.error('Error fetching room types:', error);
      return {
          statusCode: 500,
          body: JSON.stringify({
              message: "Error fetching room types",
              error: error.message
          }),
          headers: {
              'Content-Type': 'application/json'
          }
      };
  }
};

exports.cancelBooking = async (event) => {
    const bookingId = event.pathParameters.id;

    const params = {
        TableName: 'BookingTable',
        Key: { bookingId: bookingId }
    };

    try {
        await dynamodb.delete(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Booking canceled" })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error canceling booking", error: error.message })
        };
    }
};
