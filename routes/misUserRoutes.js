const express = require("express");

const misUserRouter = express.Router();
const { hashPassword, verifyPassword } = require("../utils/hashingService");
const formatDate = require("../utils/formatDate");
const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");
const authMisUser = require("../middlewares/authMW");


//Create a new MIS User
misUserRouter.post("/createUser", (req, res) => {
  
    const { name, company, contact, email_ID, PASSWORD, user_Type, client_id } = req.body;
    let finalEncryptedPassword;
  
    async function Encrypter(plainText) {
      try {
        const encryptedPassword = await hashPassword(plainText);
        return encryptedPassword;
      } catch (error) {
        console.log("Error encypting password. " + error);
      }
    }
  
    Encrypter(PASSWORD).then((response) => {
      finalEncryptedPassword = response;
  
      const tempDate = new Date();
      const reg_date = formatDate(tempDate);
      // Insert the new MIS User into the database
      db.run(
        `INSERT INTO MIS_Users (name, company, contact, email_ID, PASSWORD, USER_TYPE, Registration_Date, default_Pwd, client_id) 
        VALUES (?,?,?,?,?,?,?,?,?)`,
        [name, company, contact, email_ID, finalEncryptedPassword, user_Type, reg_date, true, client_id],
        function (err) {
          if (err) {
            console.error(err.message);
            return res.status(500).send("Internal Server Error");
          }
  
          console.log(`A new MIS User has been added with ID: ${this.lastID}`);
          res.status(201).send("MIS User created successfully");
        }
      );
    });
  });

//login API for MIS user
misUserRouter.post("/login", (req, res) => {
  const { email_ID, PASSWORD } = req.body;
  let selected_user_details;
  //query to detect if the email_ID exists
  const queryToFetchUser = `SELECT * from MIS_USERS WHERE email_ID = ?`;
  const queryToFetchPassword = `SELECT PASSWORD from MIS_USERS WHERE email_ID = ?`;

  db.get(queryToFetchUser, [email_ID], (err, result) => {
    if (err) {
      console.error("Error checking credentials:", err.message);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    if (!result) {
      console.log(`No user found! - ${email_ID}`);
      res.status(401).json({ error: `No user found! - ${email_ID}` });
      return;
    }
    if (result) {
      //user found
      selected_user_details = result;
      console.log(`Match found - ${result.email_ID}`);


      db.get(queryToFetchPassword, [email_ID], (err, result_pwd) => {
        if (err) {
          console.error("Error checking credentials:", err.message);
          res.status(500).json({ error: "Internal server error" });
          return;
        }
        if (result_pwd) {
          // Generate a UUID (Universally Unique Identifier)
          const uuid = uuidv4();

          //now verifying the password

          hashPassword(PASSWORD).then(() => {
            verifyPassword(PASSWORD, result_pwd.PASSWORD).then((resp) => {
              if (resp) {

                const temp_sessionid = uuid.substr(0, 16);

                if(result.default_Pwd == true){
                  return res.status(210).json({
                    message:"Default password detected",
                    temp_sessionid: temp_sessionid
                  })
                }

                // Extract the first 16 characters as your session ID
                const sessionId = uuid.substr(0, 16);

                //record current time and use it as timestamp for user login
                const mis_user_login_time = new Date();
                const logintime2 = formatDate(mis_user_login_time);

                //Add a record to MIS_USER_SESSION_DETAILS
                const insertQueryforMisUserSession = `INSERT INTO MIS_USER_SESSION_DETAILS 
                                                    (MIS_USER_ID, name, email_ID, company, contact, Login_Time, client_id, SESSION_ID) 
                                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

                db.run(
                  insertQueryforMisUserSession,
                  [
                    selected_user_details.id,
                    selected_user_details.name,
                    selected_user_details.email_ID,
                    selected_user_details.company,
                    selected_user_details.contact,
                    logintime2,
                    selected_user_details.client_id,
                    sessionId,
                  ],
                  (err_insert) => {
                    if (err_insert) {
                      console.error(
                        "Error inserting session record:",
                        err_insert
                      );
                      res.status(500).json({ error: "Internal server error" });
                      return;
                    }
                    // Construct the response object with user details and session ID
                    const misUserDetails = {
                      id: selected_user_details.id,
                      email_ID: selected_user_details.email_ID,
                      contact: selected_user_details.contact,
                      company: selected_user_details.company,
                      client_id:selected_user_details.client_id,
                      name: selected_user_details.name,
                      userType:selected_user_details.USER_TYPE,
                      session_ID: sessionId,
                    };

                    res.status(200).json(misUserDetails);
                  }
                );

                
              } else {
                res.status(401).json({ error: `Incorrect Password` });
                return;
              }
            });
          });
        }
      });
    }
  });
});

//logout API for MIS User
misUserRouter.post("/logout", authMisUser, (req, res) => {
  
  const user = req.user;
  const  SESSION_ID  = req.sessionId;

  const queryToDeleteSession = `DELETE FROM MIS_USER_SESSION_DETAILS WHERE SESSION_ID=?`;

  db.run(queryToDeleteSession, [SESSION_ID], (err) => {
    if (err) {
      res.status(500).send("Error logging out " + err);
      return;
    }
  });
  res.status(200).send("Logout successful!");
});

//update password of an MIS user
misUserRouter.patch("/updatePassword",authMisUser, async (req, res)=>{
  
  const {email_ID, PASSWORD } = req.body;
  const queryToFetchUser = `SELECT * from MIS_USERS WHERE email_ID = ?`;
  const newPassword = await hashPassword(PASSWORD);

  db.get(queryToFetchUser, [email_ID], async (err, result) => {
    if (err) {
      console.error("Error checking credentials:", err.message);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    if (!result) {
      console.log(`No user found! - ${email_ID}`);
      res.status(401).json({ error: `No user found! - ${email_ID}` });
      return;
    }
    if (result) {
      //user found
      selected_user_details = result;
      
      const updateMISuser = `UPDATE MIS_USERS SET PASSWORD = ?, default_Pwd=false WHERE email_ID = ?` ;
      db.run(updateMISuser,[newPassword, selected_user_details.email_ID],(err, updResult)=>{
        if (err) {
          console.error(err.message);
          return res.status(500).json({ error: "Failed to update the record" });
      }

      res.status(200).json({
          message: "Password updated successfully",
         
      });
      })

    }
  })

});

misUserRouter.post("/purchaseGames", authMisUser, async(req, res)=>{

  try{
    const {client_id, games_purchased, Pack_valid_till} = req.body;
    const purchase_date = formatDate(new Date());
  
    const querytoPurchaseGames = `INSERT INTO Client_purchases_record (client_id, games_purchased, Last_Purchase_Date, Pack_valid_till) 
                                  VALUES(?,?,?,?)`; 
    
    db.run(querytoPurchaseGames,[client_id, games_purchased, purchase_date, Pack_valid_till],(err, result)=>{
          if(err){
            res.send("Error adding record "+err);
          }
        res.json({
          message:"Games purchase successful!"
        })
    })
  }catch(err){
    res.status(500).send("Something went wrong", err);
  }
  
});

misUserRouter.get("/clientpurchasedGames", authMisUser, async (req, res)=>{

  try{
    const client_id = req.query.client_id;

    const querytoFetchClientPurchasedGames = `SELECT Games_purchased from Client_purchases_record WHERE Client_Id = ${client_id}`;
  
    db.all(querytoFetchClientPurchasedGames, (err, result)=>{
          if(err){
            res.send("Error fetching records! ", err);
          }

          res.json({
            message:"List fetched successfully!",
            data: result
          })
    })
  }catch(err){
    res.status(500).send("Something went wrong ", err);
  }
  
})



module.exports = misUserRouter