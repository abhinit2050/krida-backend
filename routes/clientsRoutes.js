const express = require("express");
const clientRouter = express.Router();
const db = require("../config/database");
const formatDate = require("../utils/formatDate");

clientRouter.post("/addClient", (req, res)=>{

    const {Client_Name, Client_email, Client_GST, Client_Address, contact, Client_Category} = req.body;
    const onboardingDate = formatDate(new Date());

    const querytoAddClient = `INSERT INTO CLIENTS ( Client_Name, Client_email, Client_GST, Client_Address, 
                    contact, Client_Category, Onboarding_date) VALUES (?, ?, ?, ?, ?, ?, ?);`

    db.run(querytoAddClient, [Client_Name, Client_email, Client_GST, Client_Address, contact, Client_Category, onboardingDate], (err)=>{
        if(err){
            res.status(500).send("Something went wrong: ", err);
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
            
            db.all(querytoFetchAllClients, (err, result)=>{
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