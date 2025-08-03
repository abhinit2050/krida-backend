const express = require("express");
const clientRouter = express.Router();
const connection = require("../config/dbmysql")
const formatDate = require("../utils/formatDate");
const crypto = require('crypto');


clientRouter.post("/addClient", (req, res)=>{

    const clientKey = crypto.randomBytes(8).toString('hex');

    const {Client_Name, Client_email, Client_GST, Client_Address, contact, Client_Category} = req.body;

    if(!Client_Name || !Client_email || !Client_GST || !Client_Address || !contact || !Client_Category){
        return res.status(400).json({ error: "All fields are required" });
    }

    const onboardingDate = formatDate(new Date());

    const querytoAddClient = `INSERT INTO CLIENTS ( Client_Name, Client_email, Client_GST, Client_Address, 
                    contact, Client_Category, Onboarding_date, Client_Key) VALUES (?, ?, ?, ?, ?, ?, ?,?);`

    connection.query(querytoAddClient, [Client_Name, Client_email, Client_GST, Client_Address, contact, 
                    Client_Category, onboardingDate, clientKey], (err)=>{
        if(err){
            res.status(500).json({ error: "Something went wrong", details: err.message });
        } else {
            res.json({
                message:"Client added successfully!"
            })
        }
    })
})

clientRouter.get("/allClients", (req, res)=>{

    try{
            const querytoFetchAllClients = `SELECT * FROM CLIENTS`;
            
            connection.query(querytoFetchAllClients, (err, result)=>{
                if(err){
                    res.status(500).send("Error fetching clients! "+err);
                }
                res.json({
                    message:"Client list",
                    data:result
                })
            })
    }catch(err){
        res.status(500).send("Something went wrong! "+err);
    }

})

module.exports = clientRouter