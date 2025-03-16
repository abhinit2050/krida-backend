const express = require('express');

const app = express();
const PORT = 5001;

app.use(express.json());

app.post('/send-otp', (req, res) => {
    try{
        const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
    }
    // Simulate sending OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    console.log(`OTP for ${phoneNumber}: ${otp}`);
    res.json({ message: 'OTP sent successfully', otp }); // In real case, don't send OTP in response

    }catch(err){
        console.log("error in service call", err);
    }
    });

app.listen(PORT, () => {
    console.log(`OTP Microservice running on port ${PORT}`);
});
