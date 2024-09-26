const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
///////////// Create Bookings
exports.createBooking = async (event) => {
  const body = JSON.parse(event.body);

  const guests = body.guests;
  const rooms = body.rooms;
  const name = body.name;
  const email = body.email;
  const checkInDate = body.checkInDate;
  const checkOutDate = body.checkOutDate;

  if (!guests || !rooms || !name || !email || !checkInDate || !checkOutDate) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message:
          "Missing required fields: guests, rooms, name, email, checkInDate, checkOutDate",
      }),
    };
  }

  const roomTypes = {
    single: { capacity: 1, price: 500 },
    double: { capacity: 2, price: 1000 },
    suite: { capacity: 3, price: 1500 },
  };

  let totalCapacity = 0;
  let totalPricePerDay = 0;
  let totalNewRooms = 0;

  // Calculate total capacity and price per day
  rooms.forEach((room) => {
    const roomInfo = roomTypes[room.type];
    if (roomInfo) {
      totalCapacity += roomInfo.capacity * room.quantity;
      totalPricePerDay += roomInfo.price * room.quantity;
      totalNewRooms += room.quantity;

      // Check if the guests exceed the capacity per room type
      if (guests > totalCapacity) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: `Guest count exceeds total room capacity. The ${
              room.quantity
            } ${room.type} room(s) can only accommodate a maximum of ${
              roomInfo.capacity * room.quantity
            } guests.`,
          }),
        };
      }
    }
  });

  if (totalCapacity !== guests) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Room capacity does not match number of guests",
      }),
    };
  }

  // Validation for check-in and check-out dates
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Invalid date format for checkInDate or checkOutDate",
      }),
    };
  }

  if (checkOut <= checkIn) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Check-out date must be after check-in date",
      }),
    };
  }

  const timeDifference = checkOut - checkIn;
  const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));

  const totalPrice = totalPricePerDay * daysDifference;

  try {
    const scanParams = {
      TableName: "BookingTable",
      ProjectionExpression: "rooms",
    };

    const scanResult = await dynamodb.scan(scanParams).promise();
    let totalBookedRooms = 0;

    scanResult.Items.forEach((booking) => {
      booking.rooms.forEach((room) => {
        totalBookedRooms += room.quantity;
      });
    });

    // Limit total amount of booked rooms
    if (totalBookedRooms + totalNewRooms > 20) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: `Cannot book more rooms. Current total is ${totalBookedRooms}, and booking ${totalNewRooms} more would exceed the limit of 20 rooms.`,
        }),
      };
    }

    // Create unique ID
    const bookingId = Date.now().toString();

    const params = {
      TableName: "BookingTable",
      Item: {
        bookingId: bookingId,
        name: name,
        email: email,
        guests: guests,
        rooms: rooms,
        totalPrice: totalPrice,
        checkInDate: checkInDate,
        checkOutDate: checkOutDate,
      },
    };

    await dynamodb.put(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Booking successful",
        bookingId: bookingId,
        totalPrice: totalPrice + " SEK",
        checkInDate: checkInDate,
        checkOutDate: checkOutDate,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error saving booking",
        error: error.message,
      }),
    };
  }
};

///////////// List Bookings
exports.listAllBookings = async (event) => {
  const params = {
    TableName: "BookingTable",
  };

  try {
    const data = await dynamodb.scan(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Bookings fetched successfully",
        bookings: data.Items,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error fetching bookings",
        error: error.message,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};
///////////// List Rooms
exports.listRooms = async (event) => {
  const roomTypes = {
    single: { capacity: 1, price: 500 },
    double: { capacity: 2, price: 1000 },
    suite: { capacity: 3, price: 1500 },
  };
  try {
    // Fetch room types information
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Room types fetched successfully",
        roomTypes: roomTypes,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  } catch (error) {
    console.error("Error fetching room types:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error fetching room types",
        error: error.message,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};
///////////// Cancel Bookings
exports.cancelBooking = async (event) => {
  const bookingId = event.pathParameters.id;

  const getParams = {
    TableName: "BookingTable",
    Key: { bookingId: bookingId },
  };

  try {
    const result = await dynamodb.get(getParams).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Booking not found" }),
      };
    }

    const booking = result.Item;
    const checkInDate = new Date(booking.checkInDate);
    const currentDate = new Date();

    const timeDifference = checkInDate - currentDate;
    const daysDifference = timeDifference / (1000 * 3600 * 24);

    // If less than 2 days before check In then you can't cancel
    if (daysDifference < 2) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Cannot cancel booking less than 2 days before check-in",
        }),
      };
    }

    // If more than 2 days before check In then you can cancel
    const deleteParams = {
      TableName: "BookingTable",
      Key: { bookingId: bookingId },
    };

    await dynamodb.delete(deleteParams).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Booking canceled" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error canceling booking",
        error: error.message,
      }),
    };
  }
};
///////////// Update Bookings
exports.updateBooking = async (event) => {
  const bookingId = event.pathParameters.id;
  const body = JSON.parse(event.body);

  const guests = body.guests;
  const rooms = body.rooms;
  const checkInDate = body.checkInDate;
  const checkOutDate = body.checkOutDate;

  if (!guests || !rooms || !checkInDate || !checkOutDate) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message:
          "Missing required fields: guests, rooms, checkInDate, checkOutDate",
      }),
    };
  }

  const roomTypes = {
    single: { capacity: 1, price: 500 },
    double: { capacity: 2, price: 1000 },
    suite: { capacity: 3, price: 1500 },
  };

  let totalCapacity = 0;
  let totalPricePerDay = 0;
  let totalUpdatedRooms = 0;
  let roomBookingLimits = { single: 0, double: 0, suite: 0 };

  // Calculate total capacity, price, and quantity per room type
  rooms.forEach((room) => {
    const roomInfo = roomTypes[room.type];
    if (roomInfo) {
      totalCapacity += roomInfo.capacity * room.quantity;
      totalPricePerDay += roomInfo.price * room.quantity;
      totalUpdatedRooms += room.quantity;
      roomBookingLimits[room.type] += room.quantity;

      // Check if guests exceed room capacity
      if (guests > totalCapacity) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: `Guest count exceeds total room capacity. The ${
              room.quantity
            } ${room.type} room(s) can only accommodate a maximum of ${
              roomInfo.capacity * room.quantity
            } guests.`,
          }),
        };
      }
    }
  });

  if (totalCapacity !== guests) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Room capacity does not match number of guests",
      }),
    };
  }

  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Invalid date format for checkInDate or checkOutDate",
      }),
    };
  }

  if (checkOut <= checkIn) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Check-out date must be after check-in date",
      }),
    };
  }

  const timeDifference = checkOut - checkIn;
  const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));
  const totalPrice = totalPricePerDay * daysDifference;

  try {
    // Scan the table to get current bookings by room type
    const scanParams = {
      TableName: "BookingTable",
      ProjectionExpression: "rooms",
    };

    const scanResult = await dynamodb.scan(scanParams).promise();

    const currentRoomBookings = { single: 0, double: 0, suite: 0 };

    scanResult.Items.forEach((booking) => {
      if (booking.bookingId !== bookingId) {
        booking.rooms.forEach((room) => {
          if (currentRoomBookings[room.type] !== undefined) {
            currentRoomBookings[room.type] += room.quantity;
          }
        });
      }
    });

    // Check if the updated booking exceeds the room limits for each type
    for (const roomType in roomBookingLimits) {
      if (
        currentRoomBookings[roomType] + roomBookingLimits[roomType] >
        roomTypes[roomType].maxQuantity
      ) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: `Cannot book more ${roomType} rooms. Current total is ${currentRoomBookings[roomType]}, and booking ${roomBookingLimits[roomType]} more would exceed the limit of ${roomTypes[roomType].maxQuantity}.`,
          }),
        };
      }
    }

    // Update the booking after validation
    const params = {
      TableName: "BookingTable",
      Key: { bookingId: bookingId },
      UpdateExpression: `set guests = :guests, rooms = :rooms, checkInDate = :checkInDate, checkOutDate = :checkOutDate, totalPrice = :totalPrice`,
      ExpressionAttributeValues: {
        ":guests": guests,
        ":rooms": rooms,
        ":checkInDate": checkInDate,
        ":checkOutDate": checkOutDate,
        ":totalPrice": totalPrice,
      },
      ReturnValues: "UPDATED_NEW",
    };

    const result = await dynamodb.update(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Booking updated successfully",
        updatedAttributes: result.Attributes,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  } catch (error) {
    console.error("Error updating booking:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error updating booking",
        error: error.message,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};
