// Ladda AWS SDK
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.createBooking = async (event) => {
    const body = JSON.parse(event.body);
  
    // Hämta nödvändiga data från body
    const guests = body.guests;
    const rooms = body.rooms;
    const name = body.name;
    const email = body.email;
    const checkInDate = body.checkInDate; // Nytt fält för incheckning
    const checkOutDate = body.checkOutDate; // Nytt fält för utcheckning
  
    // Validera att alla obligatoriska fält finns med
    if (!guests || !rooms || !name || !email || !checkInDate || !checkOutDate) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Missing required fields: guests, rooms, name, email, checkInDate, checkOutDate"
        }),
      };
    }
  
    const roomTypes = {
      "single": { capacity: 1, price: 500 },
      "double": { capacity: 2, price: 1000 },
      "suite": { capacity: 3, price: 1500 }
    };
  
    let totalCapacity = 0;
    let totalPrice = 0;
  
    rooms.forEach(room => {
      const roomInfo = roomTypes[room.type];
      if (roomInfo) {
        totalCapacity += roomInfo.capacity * room.quantity;
        totalPrice += roomInfo.price * room.quantity;
      }
    });
  
    if (totalCapacity !== guests) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Room capacity does not match number of guests" }),
      };
    }
  
    // Validera att check-in och check-out datum är giltiga
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
  
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid date format for checkInDate or checkOutDate" }),
      };
    }
  
    if (checkOut <= checkIn) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Check-out date must be after check-in date" }),
      };
    }
  
    // Skapa unikt bookingId
    const bookingId = Date.now().toString();
  
    // Skapa objekt för att lägga till i DynamoDB
    const params = {
      TableName: 'BookingTable',
      Item: {
        bookingId: bookingId,
        name: name,
        email: email,
        guests: guests,
        rooms: rooms,
        totalPrice: totalPrice,
        checkInDate: checkInDate,
        checkOutDate: checkOutDate
      }
    };
  
    try {
      // Lägg till bokningen i DynamoDB
      await dynamodb.put(params).promise();
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Booking successful",
          bookingId: bookingId,
          totalPrice: totalPrice,
          checkInDate: checkInDate,
          checkOutDate: checkOutDate
        }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Error saving booking", error: error.message }),
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
exports.updateBooking = async (event) => {
    const bookingId = event.pathParameters.id; // Få bookingId från URL:en
    const body = JSON.parse(event.body);

    const params = {
        TableName: 'BookingTable',
        Key: { bookingId: bookingId }, // Identifiera bokningen att uppdatera
        UpdateExpression: `set guests = :guests, rooms = :rooms, #name = :name, email = :email, checkInDate = :checkInDate, checkOutDate = :checkOutDate`,
        ExpressionAttributeNames: {
            '#name': 'name' // "name" är ett reserverat ord i DynamoDB, så vi måste använda ExpressionAttributeNames
        },
        ExpressionAttributeValues: {
            ':guests': body.guests,
            ':rooms': body.rooms,
            ':name': body.name,
            ':email': body.email,
            ':checkInDate': body.checkInDate,
            ':checkOutDate': body.checkOutDate
        },
        ReturnValues: "UPDATED_NEW" // Returnera de nya värdena efter uppdateringen
    };

    try {
        const result = await dynamodb.update(params).promise();
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Booking updated successfully',
                updatedAttributes: result.Attributes
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    } catch (error) {
        console.error('Error updating booking:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error updating booking',
                error: error.message
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }
};