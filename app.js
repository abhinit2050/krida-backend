//public IP: 3.111.55.132
//curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
//. ~/.nvm/nvm.sh
//nvm install node

//now refactoring
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require('axios');
const { hashPassword, verifyPassword } = require("./hashingService");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment");
const multer = require('multer'); 
const db = require("./config/database");

const app = express();

const storage = multer.memoryStorage(); // Stores files as buffers
const upload = multer({ storage: storage,
fileSize: 1024 * 1024 * 5, // 5 MB file size limit

 });

app.use(express.json()); 
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

const templateRouter = require("./routes/templateRoutes");

app.use("/",templateRouter);


db.serialize(() => {
  //Create a table for MIS users
  db.run(
    "CREATE TABLE IF NOT EXISTS MIS_USERS (id INTEGER PRIMARY KEY, name TEXT, email_ID TEXT UNIQUE, PASSWORD TEXT ,company TEXT, contact INTEGER, Registration_Date TEXT);"
  );

  //Create a table for session details of MIS users
  db.run(
    `CREATE TABLE IF NOT EXISTS MIS_USER_SESSION_DETAILS (id INTEGER PRIMARY KEY, MIS_USER_ID INT, name TEXT, email_ID TEXT, company TEXT, 
      contact INT, Login_Time TEXT ,SESSION_ID CHAR(16) UNIQUE);`
  );

  //Create a table for Players
  db.run(
    `CREATE TABLE IF NOT EXISTS PLAYERS (id INTEGER PRIMARY KEY, NAME TEXT, EMAIL_ID TEXT UNIQUE, 
      contact INTEGER UNIQUE, CLIENT_IP TEXT UNIQUE, Primary_Registration_Date Time, Secondary_Registration_Date Time);`
  );

  //create a table to record player session details
  db.run(
    `CREATE TABLE IF NOT EXISTS PLAYER_SESSION_DETAILS (PLAYERID TEXT(45), EMAIL_ID TEXT, contact INTEGER, CLIENT_IP TEXT, 
      SESSION_ID CHAR(16), 
        LOGIN_TIME_STAMP TIME, ACTIVE_DURATION INTEGER, GAME_PLAYED TEXT(50), PLATFORM TEXT(45));`
  );

  //create a table to record player session history details
  db.run(
    `CREATE TABLE IF NOT EXISTS PLAYER_HISTORY (PLAYERID TEXT(45), SESSION_ID CHAR(16), EMAIL_ID TEXT, contact INTEGER, CLIENT_IP TEXT, 
    LOGIN_TIME_STAMP TIME, LOGOUT_TIME_STAMP TIME, Primary_Registration_Date TIME, Secondary_Registration_Date Time, ACTIVE_DURATION INTEGER, 
    GAME_PLAYED TEXT(50), PLATFORM TEXT(45));`
  );

  //create a table for the games on offfer
  db.run(`CREATE TABLE IF NOT EXISTS GAMES (id INTEGER PRIMARY KEY, NAME);`);

  //create a table for CMS operations
  db.run(`CREATE TABLE IF NOT EXISTS CMS_TEMPLATE_DETAILS (id TEXT PRIMARY KEY, templateName TEXT, summary TEXT, backGroundColor TEXT, 
    cardTextColor TEXT, cardColor TEXT, hiddenText TEXT, cardFrontText TEXT, backgroundPicture BLOB, backgroundPictureBack BLOB, 
    fontSize INTEGER, fontFamily TEXT);`);

});

// Create a function to format the date as "DD-MM-YYYYTHH:MM:SS"
function formatDate(date) {

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Month is zero-based
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${day}-${month}-${year}T${hours}:${minutes}:${seconds}`;

}

//get date from string
function stringToDate(strDate) {
  // Extract day, month, year, hour, minute, second from the date string
  const [day, month, yearandtime] = strDate.split("-");
  const [year, time] = yearandtime.split("T");
  const [hour, minute, second] = time.split(":");

  let newMonth = parseInt(month);

  if (newMonth < 10) {
    newMonth = `0${newMonth}`;
  }

  // Create a new Date object using the extracted components

  const validDate = new Date(
    `${year}-${newMonth}-${day}T${hour}:${minute}:${second}`
  );

  return validDate;
}

//force logout the player after 10 minutes to count a session
function deleteAllObsoleteSessions(){

  console.log("DELETING obsolete sessions at", new Date());

  // Function to convert 'DD-MM-YYYYTHH:MM:SS' to a valid JavaScript Date object
function parseCustomDate(dateString) {
  const [datePart, timePart] = dateString.split('T');
  const [day, month, year] = datePart.split('-');
  return new Date(`${year}-${month}-${day}T${timePart}`);
}

const queryForSessionLogOut = 'SELECT * FROM PLAYER_SESSION_DETAILS';

      // Current date
      let currentDate = new Date();
      currentDate= formatDate(currentDate);
      const currentDateObj = parseCustomDate(currentDate);

      db.all(queryForSessionLogOut,(err, resultSessionLogout)=>{
          if(err){
            console.log("Error fetching session details",err);
          }

          let obsoleteRecordsArray=[];
          
          resultSessionLogout.map((resItem)=>{
            let temploginTime = (resItem.LOGIN_TIME_STAMP.toString());
            temploginTime = parseCustomDate(temploginTime);
            const diffInMs = currentDateObj - temploginTime;
            const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

            if(diffInMinutes > 30){
              obsoleteRecordsArray.push(resItem.SESSION_ID);
            }

          })

          if (obsoleteRecordsArray.length === 0) {
            // No obsolete records to delete, respond early
            console.log("No obsolete sessions to delete");
          }
          const obsoleteRecordsString = obsoleteRecordsArray.map(id  => `'${id}'`).join(',');

          const queryToDeleteObsoleteRecords = `DELETE FROM PLAYER_SESSION_DETAILS WHERE SESSION_ID IN (${obsoleteRecordsString})`;

          console.log(queryToDeleteObsoleteRecords);

          db.run(queryToDeleteObsoleteRecords,(err)=>{
                if(err){
                  console.log("Error in deleting obsolete sessions, " + err)
                }
                console.log("All obsolete sessions deleted");
          })


      })



}

//call the deleteAllObsoleteSessions function every 10 minutes
setInterval(deleteAllObsoleteSessions, 600000); // 


// Read data
db.all("SELECT * FROM MIS_USERS", (err, rows) => {
  if (err) {
    throw err;
  }
  rows.forEach((row) => {
    // console.log(row);
  });
});

//Create a new MIS User
app.post("/createUser", (req, res) => {
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

// //add a CMS template
// app.post('/template/add', upload.fields([
//   { name: 'backgroundPicture', maxCount: 1 },
//   { name: 'backgroundPictureBack', maxCount: 1 }
// ]), (req, res) => {
//   const {
//       templateName,
//       summary,
//       backGroundColor,
//       cardTextColor,
//       cardColor,
//       hiddenText,
//       cardFrontText,
//       fontSize,
//       fontFamily
//   } = req.body;


//   //Access image files (if uploaded)
//     const backgroundPicture = req.files['backgroundPicture'] ? req.files['backgroundPicture'][0].buffer : null;
//     const backgroundPictureBack = req.files['backgroundPictureBack'] ? req.files['backgroundPictureBack'][0].buffer : null;
    

//   // Generate a UUID for the id
//   const id = uuidv4();

//   // SQL command to insert data into CMS_TEMPLATE_DETAILS
//   const sql = `INSERT INTO CMS_TEMPLATE_DETAILS (
//     id, templateName, summary, backGroundColor, cardTextColor, cardColor, hiddenText, cardFrontText, backgroundPicture, backgroundPictureBack, fontSize, fontFamily
// ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// // Execute the SQL command
// db.run(sql, [id, templateName, summary, backGroundColor, cardTextColor, cardColor, hiddenText, cardFrontText, backgroundPicture, backgroundPictureBack, fontSize, fontFamily], function(err) {
//     if (err) {
//         console.error(err.message);
//         return res.status(500).json({ error: "Failed to insert data" });
//     }
//     res.status(200).json({
//         message: "Template added successfully",
//         id: id
//     });
// });
// });

// //GET ALL templates
// app.get('/all/templates', (req, res) => {
//   const queryToFetchTemplates = `SELECT * FROM CMS_TEMPLATE_DETAILS`;

//   db.all(queryToFetchTemplates, [], (err, rows) => {
//       if (err) {
//           console.error(err.message);
//           return res.status(500).json({ error: "Failed to retrieve data" });
//       }
      
//       for(var i=0;i<rows.length;i++){
//         if (rows[i].backgroundPicture) {
//           rows[i].backgroundPicture = rows[i].backgroundPicture.toString('base64');
//       } else {
//           console.warn(`Missing backgroundPicture for row ${i}`);
//           rows[i].backgroundpicture = null;
//       }
  
//       if (rows[i].backgroundPictureBack) {
//           rows[i].backgroundPictureBack = rows[i].backgroundPictureBack.toString('base64');
//       } else {
//           console.warn(`Missing backgroundPictureBack for row ${i}`);
//           rows[i].backgroundPictureBack = null;
//       }
//       }

//       res.status(200).json({
//           message: "Records retrieved successfully",
//           data: rows
//       });
//   });
// });

// //GET a specific template based on id
// app.get('/template/fetch', (req, res) => {
//   const { id } = req.query; // Use req.query for query parameters

//   if (!id) {
//       return res.status(400).json({ error: "ID is required" });
//   }

//   const queryTofetchSpecificTemplate = `SELECT * FROM CMS_TEMPLATE_DETAILS WHERE id = ?`;

//   db.get(queryTofetchSpecificTemplate, [id], (err, row) => {
//       if (err) {
//           console.error(err.message);
//           return res.status(500).json({ error: "Failed to retrieve the record" });
//       }

//       if (!row) {
//           return res.status(404).json({ message: "Record not found" });
//       }
//       if(row.backgroundPicture){
//         row.backgroundPicture = (row.backgroundPicture.toString('base64'));
//       } else {
//         console.warn(`Missing backgroundPicture for the record`);
//       }

//       if(row.backgroundPictureBack){
//         row.backgroundPictureBack = (row.backgroundPictureBack.toString('base64'));
//       } else {
//         console.warn(`Missing backgroundPictureBack for the record`);
//       }
      

//       res.status(200).json({
//           message: "Record retrieved successfully",
//           data: row
//       });
//   });
// });

// //Modify a particular template
// app.patch('/template/modify',upload.fields([
//   { name: 'backgroundPicture', maxCount: 1 },
//   { name: 'backgroundPictureBack', maxCount: 1 }
// ]) ,(req, res) => {
//   const { id } = req.query; // Use query parameters to get the id of the record to update
//   console.log("modify template body",req.body);
  

//   if (!id) {
//       return res.status(400).json({ error: "ID is required" });
//   }

//   let backgroundPictureValue;
//   let backgroundPictureBackValue;
//   let cardTextColorValue;
//   let cardColorValue;

//   // Fetch the existing record first
//   const selectSql = `SELECT * FROM CMS_TEMPLATE_DETAILS WHERE id = ?`;

//   db.get(selectSql, [id], (err, existingRecord) => {
//       if (err) {
//           console.error(err.message);
//           return res.status(500).json({ error: "Failed to retrieve the record" });
//       }

//       if (!existingRecord) {
//           return res.status(404).json({ message: "Record not found" });
//       }


//       if(req.files['backgroundPicture'] && req.files['backgroundPictureBack']){
//         console.log("picture detected");
//           backgroundPictureValue = req.files['backgroundPicture'][0].buffer;
//           backgroundPictureBackValue = req.files['backgroundPictureBack'][0].buffer;
//           cardTextColorValue = existingRecord.cardTextColor;
//           cardColorValue = existingRecord.cardColor;

//       } else if(req.body.cardTextColor){
//         console.log("card text color detected");
//         cardTextColorValue = req.body.cardTextColor;
//         cardColorValue = req.body.cardColor;
//         backgroundPictureValue=req.body.backgroundPicture;
//         backgroundPictureBackValue=req.body.backgroundPictureBack;
//       }

//       console.log("values", cardTextColorValue, cardColorValue);

//       // Prepare updated values: use existing values for columns not provided by the user
//       const updatedData = {
//         templateName: req.body.templateName || existingRecord.templateName,
//         summary: req.body.summary || existingRecord.summary,
//         backGroundColor: req.body.backGroundColor || existingRecord.backGroundColor,
//         cardTextColor:cardTextColorValue,
//         cardColor:cardColorValue,
//         hiddenText: req.body.hiddenText || existingRecord.hiddenText,
//         cardFrontText: req.body.cardFrontText || existingRecord.cardFrontText,
//         backgroundPicture:backgroundPictureValue,
//         backgroundPictureBack:backgroundPictureBackValue,
//         fontSize: req.body.fontSize || existingRecord.fontSize,
//         fontFamily: req.body.fontFamily || existingRecord.fontFamily
//     };


//       // SQL for updating the record
//       const updateTemplate = `UPDATE CMS_TEMPLATE_DETAILS SET 
//       templateName = ?, 
//       summary = ?, 
//       backGroundColor = ?,
//       cardTextColor = ?,
//       cardColor=?,
//       hiddenText = ?, 
//       cardFrontText = ?, 
//       backgroundPicture = ?, 
//       backgroundPictureBack = ?, 
//       fontSize = ?, 
//       fontFamily = ?
//   WHERE id = ?`;

//       // Execute the update
//       db.run(updateTemplate, [
//         updatedData.templateName,
//         updatedData.summary,
//         updatedData.backGroundColor,
//         updatedData.cardTextColor,
//         updatedData.cardColor,
//         updatedData.hiddenText,
//         updatedData.cardFrontText,
//         updatedData.backgroundPicture,
//         updatedData.backgroundPictureBack,
//         updatedData.fontSize,
//         updatedData.fontFamily,
//         id
//     ], function(err) {
//           if (err) {
//               console.error(err.message);
//               return res.status(500).json({ error: "Failed to update the record" });
//           }

//           res.status(200).json({
//               message: "Record updated successfully",
//               updatedId: id
//           });
//       });
//   });
// });


// //DELETE a particular template
// app.delete('/template/delete', (req, res) => {
//   const { id } = req.query ;
  
//   if (!id) {
//     return res.status(400).json({ error: "ID is required" });
// }

// const queryToDeleteTemplate = `DELETE FROM CMS_TEMPLATE_DETAILS WHERE id = ?`;

// db.run(queryToDeleteTemplate, [id], function(err) {
//     if (err) {
//         console.error(err.message);
//         return res.status(500).json({ error: "Failed to delete the record" });
//     }

//     if (this.changes === 0) {
//         return res.status(404).json({ message: "Record not found" });
//     }

//     res.status(200).json({
//         message: "Record deleted successfully",
//         deletedId: id
//     });
// });
// });


//Home page route
app.get("/", (req, res) => {
  res.send("You have landed on Home page of server");
});

//GET Ip address of the player
app.get('/fetchip', async (req, res) => {
  
try{
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let clientIp_final = clientIp.split('::ffff:')[1];
  res.status(201).send(clientIp_final);
}

catch (error){
  res.status(500).send('Error fetching IP address');
}

});


//check for duplicity of a player
app.get("/playerdupcheck",(req, res)=>{

  const {CLIENT_IP} = req.query;
 
  const queryToFetchDuplicatePlayers = `SELECT COUNT(*) FROM PLAYERS WHERE CLIENT_IP=?`
  const params = [CLIENT_IP];


  db.get(queryToFetchDuplicatePlayers, params, (err, resultDuplicate)=>{
    if (err) {
      res.status(500).send("Error " + err);
      return;
    }
    if(resultDuplicate['COUNT(*)']>0){
      console.log("res dupT", resultDuplicate['COUNT(*)']);
      res.status(201).send(true);
    } else {
      console.log("res dup", resultDuplicate);
      
      console.log("res dupF", resultDuplicate['COUNT(*)']);
      res.status(201).send(false);
    }
   
  })

})

//Create a new Player
app.post("/addPlayer", (req, res) => {
  const { NAME, EMAIL_ID, contact, CLIENT_IP, platform, GAME_PLAYED } = req.body;

  console.log("Entered add Player function");

  const tempDate = new Date();
  const primary_reg_date_player = formatDate(tempDate);

  // Insert the new player into the database
  db.run(
    `INSERT INTO PLAYERS ( CLIENT_IP, Primary_Registration_Date, contact, NAME, EMAIL_ID) VALUES (?, ?, ?, ?, ?)`,
    [CLIENT_IP, primary_reg_date_player, contact, NAME, EMAIL_ID],
    function (err) {
      if (err) {
        console.error(err.message);
        return res.status(500).send("Internal Server Error");
      }
      return res.status(201).send("New player added successfully!");
    }
  );
})

//update a player
app.post("/updatePlayer",(req,res)=>{

  const { NAME, EMAIL_ID, contact, CLIENT_IP } = req.body;

  const queryToUpdateClientRecord = `UPDATE PLAYERS SET NAME = '${NAME}', EMAIL_ID='${EMAIL_ID}', contact='${contact}', 
  Secondary_Registration_Date=? WHERE CLIENT_IP='${CLIENT_IP}';`;

  const tempDate2 = new Date();
  const secondary_reg_date_player = formatDate(tempDate2);
  console.log(secondary_reg_date_player);

  db.run( queryToUpdateClientRecord, [secondary_reg_date_player], (errUpdate, resUpdate) => {
      if (errUpdate) {
          console.log("Error updating existing player", errUpdate);
          res.status(400).send(errUpdate.code==="SQLITE_CONSTRAINT"?"Duplicate values of Email or contact not allowed":errUpdate.code);
      } else if (!errUpdate) {
          // console.log("Updated client result ", resUpdate);

          console.log(
          `An existing player has been updated with IP address: ${CLIENT_IP}`
          );
          res.status(202).send("Player updated successfully");
          return;
      } 
  })
})

//Add a Game
app.post("/addGame", (req, res) => {
  const { NAME } = req.body;


  // Insert the new game into the database
  db.run(`INSERT INTO GAMES (NAME) VALUES (?)`, [NAME], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Internal Server Error");
    }

    console.log(`A new game has been added with ID: ${this.lastID}`);
    res.status(201).send("Game created successfully");
  });
});

//login API for MIS user
app.post("/login", (req, res) => {
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
app.post("/logout", (req, res) => {
  const { SESSION_ID } = req.body;

  const queryToDeleteSession = `DELETE FROM MIS_USER_SESSION_DETAILS WHERE SESSION_ID=?`;
  db.run(queryToDeleteSession, [SESSION_ID], (err) => {
    if (err) {
      res.status(500).send("Error logging out " + err);
      return;
    }
  });
  res.status(200).send("Logout successful!");
});


//login API for player- Client IP 
app.post("/loginPlayerip", (req, res) => {
  const { platform, GAME_PLAYED, CLIENT_IP } = req.body;
  
  let selected_player_details;
 
  //query to detect if the contact exists
  const queryToFetchPlayer = `SELECT * from PLAYERS WHERE CLIENT_IP = ?`;
  
  db.get(queryToFetchPlayer, [CLIENT_IP], (err, result) => {
    
      if (err) {
      console.error("Error checking credentials:", err);
      res.status(500).json({ error: "Internal server error" });
      return;
      }
  
      if (result) {
      //user found
      selected_player_details = result;
      console.log(`Match found - ${result.CLIENT_IP}`);
  
      // Generate a UUID (Universally Unique Identifier)
      const uuid = uuidv4();
  
      // Extract the first 16 characters as your session ID for the player
      const sessionId_player = uuid.substr(0, 16);
        console.log("session ID", sessionId_player);
        
      //record current time and use it as timestamp for player login
      const player_login_time = new Date();
      const logintime2_player = formatDate(player_login_time);
  
      //Add a record to PLAYER_SESSION_DETAILS
      const insertQueryforPlayerSession = `INSERT INTO PLAYER_SESSION_DETAILS 
          (PLAYERID, EMAIL_ID, contact, CLIENT_IP, SESSION_ID, LOGIN_TIME_STAMP, GAME_PLAYED, PLATFORM ) 
          VALUES (?, ?, ?, ?, ?,?, ?, ?)`;
  
      db.run(
          insertQueryforPlayerSession,
          [
          selected_player_details.id,
          selected_player_details.EMAIL_ID,
          selected_player_details.contact,
          selected_player_details.CLIENT_IP,
          sessionId_player,
          logintime2_player,
          GAME_PLAYED,
          platform,
          ],
          (err_insert) => {
          if (err_insert) {
              console.error("Error inserting session record:", err_insert);
              res.status(500).json({ error: "Internal server error" });
              return;
          }
          }
      );
  
      //Now adding the same record in Player History Table
  
      let player_primary_reg_date;
  
      const queryTofetchPrimaryRegDate = `SELECT Primary_Registration_Date from PLAYERS WHERE id = ?`;
  
      db.get(
          queryTofetchPrimaryRegDate,
          [selected_player_details.id],
          (errRegDate, resRegDate) => {
          if (errRegDate) {
              console.error(
              "Error fetching primary registration date:",
              errRegDate
              );
              res.status(500).json({ error: "Internal server error" });
              return;
          }
          //gather primary registration date
          player_primary_reg_date = resRegDate.Primary_Registration_Date;
  
          //preparing query for adding record to Player History table
          const insertQueryforPlayerHistory = `INSERT INTO PLAYER_HISTORY 
      (PLAYERID, EMAIL_ID, contact, CLIENT_IP, SESSION_ID, LOGIN_TIME_STAMP, Primary_Registration_Date, 
          GAME_PLAYED, PLATFORM ) 
      VALUES (?, ?, ?, ?, ?,?, ?, ?, ?);`;
  
          db.run(
              insertQueryforPlayerHistory,
              [
              selected_player_details.id,
              selected_player_details.EMAIL_ID,
              selected_player_details.contact,
              selected_player_details.CLIENT_IP,
              sessionId_player,
              logintime2_player,
              player_primary_reg_date,
              GAME_PLAYED,
              platform,
              ],
              (err_history) => {
              if (err_history) {
                  console.error("Error inserting in history table:", err_history);
                  res.status(500).json({ error: "Internal server error" });
                  return;
              }
  
              // Construct the response object with user details and session ID
              const playerDetails = {
                  id: selected_player_details.id,
                  email_ID: selected_player_details.EMAIL_ID,
                  contact: selected_player_details.contact,
                  reg_date: selected_player_details.Primary_Registration_Date,
                  name: selected_player_details.NAME,
                  session_ID: sessionId_player,
              };
  
              res.status(200).json(playerDetails);
              }
          );
          }
      );
      }
  });
  });

//login API for player - credentials
app.post("/loginPlayerCredentials", (req, res) => {
  const { contact, platform, GAME_PLAYED } = req.body;
  
  let selected_player_details;
  
  //query to detect if the contact exists
  const queryToFetchPlayer = `SELECT * from PLAYERS WHERE contact = ?`;
  
  db.get(queryToFetchPlayer, [contact], (err, result) => {
      if (err) {
      console.error("Error checking credentials:", err);
      res.status(500).json({ error: "Internal server error" });
      return;
      }
  
      if (result) {
      //user found
      selected_player_details = result;
      console.log(`Match found - ${result.contact}`);
  
      // Generate a UUID (Universally Unique Identifier)
      const uuid = uuidv4();
  
      // Extract the first 16 characters as your session ID for the player
      const sessionId_player = uuid.substr(0, 16);
  
      //record current time and use it as timestamp for player login
      const player_login_time = new Date();
      const logintime2_player = formatDate(player_login_time);
  
      //Add a record to PLAYER_SESSION_DETAILS
      const insertQueryforPlayerSession = `INSERT INTO PLAYER_SESSION_DETAILS 
          (PLAYERID, EMAIL_ID, contact, CLIENT_IP, SESSION_ID, LOGIN_TIME_STAMP, GAME_PLAYED, PLATFORM ) 
          VALUES (?, ?, ?, ?, ?,?, ?, ?)`;
  
      db.run(
          insertQueryforPlayerSession,
          [
          selected_player_details.id,
          selected_player_details.EMAIL_ID,
          selected_player_details.contact,
          selected_player_details.CLIENT_IP,
          sessionId_player,
          logintime2_player,
          GAME_PLAYED,
          platform,
          ],
          (err_insert) => {
          if (err_insert) {
              console.error("Error inserting session record:", err_insert);
              res.status(500).json({ error: "Internal server error" });
              return;
          }
          }
      );
  
      //Now adding the same record in Player History Table
  
      let player_primary_reg_date;
  
      const queryTofetchPrimaryRegDate = `SELECT Primary_Registration_Date from PLAYERS WHERE id = ?`;
  
      db.get(
          queryTofetchPrimaryRegDate,
          [selected_player_details.id],
          (errRegDate, resRegDate) => {
          if (errRegDate) {
              console.error(
              "Error fetching primary registration date:",
              errRegDate
              );
              res.status(500).json({ error: "Internal server error" });
              return;
          }
          let insertQueryforPlayerHistory;
          //gather primary registration date
          player_primary_reg_date = resRegDate.Primary_Registration_Date;
         
          //preparing query for adding record to Player History table
      insertQueryforPlayerHistory = `INSERT INTO PLAYER_HISTORY 
      (PLAYERID, EMAIL_ID, contact, CLIENT_IP, SESSION_ID, LOGIN_TIME_STAMP, Primary_Registration_Date, Secondary_Registration_Date, 
          GAME_PLAYED, PLATFORM ) 
      VALUES (?, ?, ?, ?, ?,?, ?, ?, ?, ?)`
  
          db.run(
              insertQueryforPlayerHistory,
              [
              selected_player_details.id,
              selected_player_details.EMAIL_ID,
              selected_player_details.contact,
              selected_player_details.CLIENT_IP,
              sessionId_player,
              logintime2_player,
              player_primary_reg_date,
              selected_player_details.Secondary_Registration_Date,
              GAME_PLAYED,
              platform,
              ],
              (err_history) => {
              if (err_history) {
                  console.error("Error inserting in history table:", err_history);
                  res.status(500).json({ error: "Internal server error" });
                  return;
              }
  
              // Construct the response object with user details and session ID
              const playerDetails = {
                  id: selected_player_details.id,
                  email_ID: selected_player_details.EMAIL_ID,
                  contact: selected_player_details.contact,
                  reg_date: selected_player_details.Primary_Registration_Date,
                  name: selected_player_details.NAME,
                  session_ID: sessionId_player,
              };
  
              res.status(200).json(playerDetails);
              }
          );
          }
      );
      }
  });
  });

//logout API for player
app.post("/logoutPlayer", (req, res) => {
  const { SESSION_ID } = req.body;

  if (!SESSION_ID) {
      return res.status(400).json({ error: "SESSION_ID is required" });
  }

  // Delete row from PLAYER_SESSION_DETAILS
  db.run(`DELETE FROM PLAYER_SESSION_DETAILS WHERE SESSION_ID = ?`, [SESSION_ID], function(err) {
      if (err) {
          return res.status(500).json({ error: err.message });
      }
      console.log(`Deleted ${this.changes} row(s) from PLAYER_SESSION_DETAILS`);

      // Update PLAYER_HISTORY table
     
      let logoutTimestamp_temp = new Date(); // current timestamp
      let logoutTimestamp = formatDate(logoutTimestamp_temp)
     
      console.log("logout time stamp",logoutTimestamp);
      
      db.get(`SELECT LOGIN_TIME_STAMP FROM PLAYER_HISTORY WHERE SESSION_ID = ?`, [SESSION_ID], (err, row) => {
          if (err) {
              return res.status(500).json({ error: err.message });
          }
          
          const loginTimestamp = row.LOGIN_TIME_STAMP;
          console.log("login time stamp",loginTimestamp);

          // Calculate active duration in seconds
          const loginTime = moment(loginTimestamp, 'DD-MM-YYYYTHH:mm:ss');
          const logoutTime = moment(logoutTimestamp, 'DD-MM-YYYYTHH:mm:ss');
        console.log("both", logoutTime, loginTime);
        const activeDuration = logoutTime.diff(loginTime, 'seconds');

        console.log("active duration",activeDuration);

          // Update PLAYER_HISTORY table
          db.run(`UPDATE PLAYER_HISTORY SET LOGOUT_TIME_STAMP = ?, ACTIVE_DURATION = ? WHERE SESSION_ID = ?`, 
                 [logoutTimestamp, activeDuration, SESSION_ID], function(err) {
              if (err) {
                  return res.status(500).json({ error: err.message });
              }
              console.log(`Updated ${this.changes} row(s) in PLAYER_HISTORY`);
              res.json({ message: 'Logout successful' });
          });
      });
  });
});


//fetch data of all active players
app.get("/fetchActivePlayers", (req, res) => {

  let active_player_count=0;
  let todayDate = new Date();
  todayDate = formatDate(todayDate);
  todayDate = (todayDate.split('T')[0]);

  const queryToFetchActivePlayers = 'SELECT SUBSTR(LOGIN_TIME_STAMP, 1, 10) AS date_only FROM PLAYER_HISTORY';

 

  db.all(queryToFetchActivePlayers,(err, resultActive) => {
    if (err) {
      res.status(500).send("Error " + err);
      return;
    }

    let temp_activePlayer_array = [];
    
    resultActive.map(item => temp_activePlayer_array.push(item.date_only));
        temp_activePlayer_array.map((item)=>{
          if(item == todayDate){
            active_player_count++;
          }
   });

   const activePlayersCount = {
        "active_players":active_player_count
   }
    
    res.status(201).json(activePlayersCount);
  });
});

//fetch Active duration of all the players
app.get("/active_duration_all", (req, res) => {
  // Query the database to get playerID and login_time_stamp
  db.all(
    "SELECT PLAYERID, EMAIL_ID, LOGIN_TIME_STAMP FROM PLAYER_SESSION_DETAILS",
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Calculate active_duration for each player
      const activeDurations = rows.map((row) => {
        const loginTimestamp = moment(
          row.LOGIN_TIME_STAMP,
          "DD-MM-YYYYTHH:mm:ss"
        );
        const now = moment();
        const duration = moment.duration(now.diff(loginTimestamp));
        return {
          playerID: row.PLAYERID,
          email_ID: row.EMAIL_ID,
          active_duration: duration.asSeconds(), // Convert duration to seconds
        };
      });

      res.json(activeDurations);
    }
  );
});

//fetch count of total number of players
app.get("/total_player_count", (req, res) => {
  db.get(
    "SELECT count(*) AS total_player_count from PLAYERS",
    (err, resCount) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      res.status(200).json({ count: resCount.total_player_count });
    }
  );
});

//fetch details of all the games played between 2 dates (both inclusive)
app.get("/game_total_count", (req, res) => {
  // Extract the from date and to date from the query parameters
  const fromDate = req.query.fromDate;
  const toDate = req.query.toDate;

  // Query to get the count of players registered between the from date and to date
  const queryToFetchGameTotalCount =
    "SELECT COUNT(*) AS game_total_count FROM PLAYER_HISTORY WHERE LOGIN_TIME_STAMP BETWEEN ? AND ?";

  // Execute the query with the fromDate and toDate as parameters
  db.get(queryToFetchGameTotalCount, [fromDate, toDate], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    //generate result
    const REALTIME_CARD_DATA = [
      {
        metric: "Game Total Count",
        metricValue: row.game_total_count,
        percentage: null,
      },
    ];

    // Return the count of players registered between the from date and to date
    res.json(REALTIME_CARD_DATA);
  });
});

//fetch unique players who played between 2 dates (both inclusive)
app.get("/unique_player_count", (req, res) => {
  // Extract the from date and to date from the query parameters
  const fromDate = req.query.fromDate;
  const toDate = req.query.toDate;

  //query to get the count of unique players between the dates
  const queryToFetchUniquePlayers = `SELECT COUNT(DISTINCT PLAYERID) AS total_unique_players FROM PLAYER_HISTORY
WHERE LOGIN_TIME_STAMP BETWEEN ? AND ?;`;

  db.get(queryToFetchUniquePlayers, [fromDate, toDate], (err, row) => {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log("Total unique players:", row.total_unique_players);
    res.status(201).send(row);
  });
});

//fetch the count of players registered between 2 dates (both inclusive)
app.get("/new_player_count", (req, res) => {
  // Extract the from date and to date from the query parameters
  let fromDate = req.query.fromDate;
  let toDate = req.query.toDate;


  const queryToFetchNewPlayers =
  `SELECT DISTINCT * FROM PLAYER_HISTORY WHERE LOGIN_TIME_STAMP BETWEEN ? AND ? 
  AND Primary_Registration_Date BETWEEN ? AND ? GROUP BY PLAYERID;`;

  // Execute the query with the fromDate and toDate as parameters
  db.all(queryToFetchNewPlayers, [fromDate, toDate, fromDate, toDate], (errNew, rowNew) => {
    if (errNew) {
      console.log(errNew);
      return res.status(500).json({ error: errNew.message });
    }


    //generate result
    const REALTIME_CARD_DATA = [
     
      {
        metric: "New Players",
        metricValue: rowNew.length,
        percentage: null,
      },
    ];

    res.json(REALTIME_CARD_DATA);
  });
});


//fetch the count of players returned between 2 dates (both inclusive)
app.get("/ret_player_count",(req,res)=>{

    // Extract the from date and to date from the query parameters
    let fromDate = req.query.fromDate;
    let toDate = req.query.toDate;

    //query to fetch returning players between to and from dates
    const queryTofetchReturnPlayers = `SELECT PLAYERID, COUNT(*) AS login_count
            FROM PLAYER_HISTORY
            WHERE LOGIN_TIME_STAMP BETWEEN Primary_Registration_Date AND ?
            GROUP BY PLAYERID;`;

    db.all(queryTofetchReturnPlayers,[toDate],(errRet, rowRet)=>{
      if(errRet){
        console.log(errRet);
      }

      let finalRowRet = rowRet.filter((row)=>{
      return row.login_count>=4
      })

      console.log("final row ret", finalRowRet);
      //generate result
      const REALTIME_CARD_DATA = [
        
        {
          metric: "Returning Players",
          metricValue: finalRowRet.length,
          percentage: null,
        },
      ];

      res.json(REALTIME_CARD_DATA);

      })
                                
})


//average playing time for a game between two dates
app.get("/averagePlayTime", (req, res) => {
  const {GAME_PLAYED} = req.query;
  const  fromDate = req.query.fromDate;
  const  toDate = req.query.toDate;

  // Fetch the rows from PLAYER_HISTORY for the specified game and date range
  db.all(`SELECT ACTIVE_DURATION FROM PLAYER_HISTORY WHERE GAME_PLAYED = ? AND LOGIN_TIME_STAMP BETWEEN ? AND ?`, 
         [GAME_PLAYED, fromDate, toDate], (err, rows) => {
      if (err) {
          return res.status(500).json({ error: err.message });
      }

      let sum=0;
      // Calculate the total active duration
      const totalActiveDuration = rows.map((row) => {
        if (row.ACTIVE_DURATION !== null) {
          let activ_dur = parseFloat(row.ACTIVE_DURATION);
            sum = sum+ activ_dur;
        } else {
            return sum;
        }
    }, 0);
    
      // Calculate the average active duration
      const averageActiveDuration = rows.length > 0 ? sum / rows.length : 0;

      res.json({ game: GAME_PLAYED, average_active_duration: averageActiveDuration });
  });
});



//Average game played count per player for a specified date range
app.get("/games_per_player",(req,res)=>{
  
  //firstly find the total game count between two dates
  
  // Extract the from date and to date from the query parameters
  const fromDate = req.query.fromDate;
  const toDate = req.query.toDate;
  
  let game_count_total;
  let player_count_total;

  // Query to get the count of total sessions by all players combined between the from date and to date
  const queryToFetchGameTotalCount =
    "SELECT COUNT(*) AS game_count_total_query FROM PLAYER_HISTORY WHERE LOGIN_TIME_STAMP BETWEEN ? AND ?";

  // Execute the query with the fromDate and toDate as parameters
  db.get(queryToFetchGameTotalCount, [fromDate, toDate], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    game_count_total = row.game_count_total_query;

    //now find the distinct count of the players who played these games
    const queryTofetchDistinctPlayerCount = `SELECT COUNT(DISTINCT PLAYERID) AS distinct_players_count
    FROM PLAYER_HISTORY WHERE LOGIN_TIME_STAMP BETWEEN ? AND ?`;

    db.get(queryTofetchDistinctPlayerCount, [fromDate, toDate], (errPlCount, rowPlCount)=>{
      if(errPlCount){
        return res.status(500).json({ error: err.message });
      }
    player_count_total = rowPlCount.distinct_players_count;

    //generate result
    const REALTIME_CARD_DATA = [
      {
        metric: "Average Game Per player",
        game_count: game_count_total,
        player_count: player_count_total,
        metricValue: (game_count_total/player_count_total).toFixed(2),
        percentage: null,
      },
    ];
        res.json(REALTIME_CARD_DATA).status(202);
    })
    
  });
})


//Individual game counts for a specified date range
app.get("/each_game_count",(req,res)=>{

  const fromDate = req.query.fromDate;
  const toDate = req.query.toDate;

  const queryToFetchEachGameCount = `SELECT GAME_PLAYED AS game_name, COUNT(GAME_PLAYED) AS game_count FROM PLAYER_HISTORY
  WHERE LOGIN_TIME_STAMP BETWEEN ? AND ? GROUP BY GAME_PLAYED`;

  db.all(queryToFetchEachGameCount,[fromDate, toDate],(errGame,rowsGame)=>{
      if(errGame){
        return res.status(500).json({ error: errGame.message });
      }
    res.status(202).json(rowsGame);
  })
})

//Listening on port 3500
app.listen("3500", () => {
  console.log("Server listening on Port 3500");
});
