const express = require("express");

const misUserRouter = express.Router();
const { hashPassword, verifyPassword } = require("../utils/hashingService");
const formatDate = require("../utils/formatDate");
const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");
const authMisUser = require("../middlewares/authMW");


//Create a new MIS User
misUserRouter.post("/createUser", (req, res) => {
    const { name, company, contact, email_ID, PASSWORD } = req.body;
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
        `INSERT INTO MIS_Users (name, company, contact, email_ID, PASSWORD, Registration_Date) VALUES (?, ?, ?,?,?,?)`,
        [name, company, contact, email_ID, finalEncryptedPassword, reg_date],
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
          //console.log(result_pwd.PASSWORD);

          //now verifying the password

          hashPassword(PASSWORD).then(() => {
            verifyPassword(PASSWORD, result_pwd.PASSWORD).then((resp) => {
              if (resp) {
                // Generate a UUID (Universally Unique Identifier)
                const uuid = uuidv4();

                // Extract the first 16 characters as your session ID
                const sessionId = uuid.substr(0, 16);

                //record current time and use it as timestamp for user login
                const mis_user_login_time = new Date();
                const logintime2 = formatDate(mis_user_login_time);

                //Add a record to MIS_USER_SESSION_DETAILS
                const insertQueryforMisUserSession = `INSERT INTO MIS_USER_SESSION_DETAILS 
                                                    (MIS_USER_ID, name, email_ID, company, contact, Login_Time, SESSION_ID) 
                                                    VALUES (?, ?, ?, ?, ?, ?, ?)`;

                db.run(
                  insertQueryforMisUserSession,
                  [
                    selected_user_details.id,
                    selected_user_details.name,
                    selected_user_details.email_ID,
                    selected_user_details.company,
                    selected_user_details.contact,
                    logintime2,
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
                      name: selected_user_details.name,
                      userType:selected_user_details.USER_TYPE,
                      session_ID: sessionId,
                    };

                    res.status(200).json(misUserDetails);
                  }
                );

                console.log("Session ID:", sessionId);
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

module.exports = misUserRouter