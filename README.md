## Ett rumsbokningssystem-API skapat för AWS (FE-23 Folkuniversitetet Göteborg)
### Gruppmedlemmar:
Alexander Buckard, Philip Älgebrink, Erik Karlsson
### Tekniker som används i projektet: 
- Serverless
- API Gateway
- dynamoDB
- Lambda
  
Paket som installerats i VS Code: Serverless och AWS SDK.

>[!IMPORTANT]
>I dynamoDB så krävs det en partition key : roomID (String)

### Endpoints:
| Request       | URL           | Resultat |
| ------------- |:-------------:| -----:|
| GET      |https://2i401tnlz3.execute-api.eu-north-1.amazonaws.com/dev/rooms | Listar vilka rumstyper som finns tillgängliga och priser |
| GET      |https://2i401tnlz3.execute-api.eu-north-1.amazonaws.com/dev/bookings | Listar nuvarande rumsbokningar |
| POST      |https://2i401tnlz3.execute-api.eu-north-1.amazonaws.com/dev/bookings | Gör en rumsbokning (se nedan för formatet på POST-begäran) |
| DELETE      |https://2i401tnlz3.execute-api.eu-north-1.amazonaws.com/dev/bookings/{id} | Tar bort rumsbokning med givet ID om det är mer än två dagar kvar till incheckningsdatum |
| PUT      |https://2i401tnlz3.execute-api.eu-north-1.amazonaws.com/dev/bookings/{id} | Ändrar rumsbokning med givet ID |



### POST-begäran ska följa detta syntax:

```
{
  "guests": 4,
  "rooms": [
    {
      "type": "double",
      "quantity": 2
    }
  ],
  "name": "John Doe",
  "email": "john.doe@example.com",
  "checkInDate": "2024-09-20",
  "checkOutDate": "2024-09-25"
}
```
### Exempel på bekräftelse efter lyckad bokning:
```
{
    "message": "Booking successful",
    "bookingId": "1726131812535",
    "totalPrice": "7500 SEK",
    "checkInDate": "2024-09-20",
    "checkOutDate": "2024-09-25"
}
```

  


