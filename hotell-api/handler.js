// Ladda AWS SDK
const AWS = require('aws-sdk');

// Skapa en instans av DynamoDB DocumentClient
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.listRooms = async (event) => {
    // Logik för att lista tillgängliga rum
};

exports.createBooking = async (event) => {
    const body = JSON.parse(event.body);
    const guests = body.guests;
    const rooms = body.rooms;

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
            body: JSON.stringify({ message: "Room capacity does not match number of guests" })
        };
    }

    const bookingId = Date.now().toString();
    const params = {
        TableName: 'BookingTable',
        Item: {
            bookingId: bookingId,
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
