//public IP: 3.111.55.132
//curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
//. ~/.nvm/nvm.sh
//nvm install node

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
// const axios = require('axios');
// const { hashPassword, verifyPassword } = require("./utils/hashingService");
// const { v4: uuidv4 } = require("uuid");
// const moment = require("moment");
const multer = require('multer'); 
const db = require("./config/database");
const formatDate = require("./utils/formatDate");
const app = express();

// const storage = multer.memoryStorage(); // Stores files as buffers
// const upload = multer({ storage: storage,
// fileSize: 1024 * 1024 * 5, // 5 MB file size limit

//  });

app.use(express.json()); 
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

const misUserRouter = require("./routes/misUserRoutes");
const templateRouter = require("./routes/templateRoutes");
const playerRouter = require("./routes/playerRoutes");
const metricRouter = require("./routes/metricRoutes");
const gameRouter = require("./routes/gameRoutes");
const clientRouter = require("./routes/clientsRoutes");

app.use("/", misUserRouter);
app.use("/",templateRouter);
app.use("/", playerRouter);
app.use("/", metricRouter);
app.use("/", gameRouter);
app.use("/", clientRouter)


db.serialize(() => {

  //Create a table for Clients
  db.run(`CREATE TABLE IF NOT EXISTS CLIENTS (id INTEGER PRIMARY KEY, Client_Name TEXT, Client_email TEXT UNIQUE, Client_GST TEXT UNIQUE,
         Client_Address TEXT, contact INTEGER unique, Client_Category TEXT, Onboarding_date Time)`);

  //Create a table for client purchase details
  db.run(`CREATE TABLE IF NOT EXISTS Client_purchases_record (id INTEGER PRIMARY KEY, Client_Id TEXT, Games_purchased TEXT, 
     Last_Purchase_date TIME, Pack_valid_till TIME)`);

  //Create a table for MIS users
  db.run(
    `CREATE TABLE IF NOT EXISTS MIS_USERS (id INTEGER PRIMARY KEY, name TEXT, email_ID TEXT UNIQUE, 
    PASSWORD TEXT ,company TEXT, contact INTEGER unique, Registration_Date TEXT, USER_TYPE TEXT, default_Pwd boolean, client_id TEXT);`
  );

  //Create a table for user types
  db.run(`CREATE TABLE IF NOT EXISTS User_Type (id INTEGER PRIMARY KEY, user_type_value TEXT)`);

  //Create a table for session details of MIS users
  db.run(
    `CREATE TABLE IF NOT EXISTS MIS_USER_SESSION_DETAILS (id INTEGER PRIMARY KEY, MIS_USER_ID INT, name TEXT, email_ID TEXT, company TEXT, 
    client_id TEXT, contact INT, Login_Time TEXT ,SESSION_ID CHAR(16) UNIQUE);`);

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
setInterval(deleteAllObsoleteSessions, 600000); 


//Home page route
app.get("/", (req, res) => {
  console.log("Home page API hit");
  res.send("You have landed on Home page of server");
});



//Listening on port 3500
app.listen("3500", () => {
  console.log("Server listening on Port 3500");
});
