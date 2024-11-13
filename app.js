//public IP: 3.111.55.132
//curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
//. ~/.nvm/nvm.sh
//nvm install node

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require('axios');
const { hashPassword, verifyPassword } = require("./utils/hashingService");
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
const misUserRouter = require("./routes/misUserRoutes");
const playerRouter = require("./routes/playerRoutes");

app.use("/",templateRouter);
app.use("/", misUserRouter);
app.use("/", playerRouter);


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


// Read data
db.all("SELECT * FROM MIS_USERS", (err, rows) => {
  if (err) {
    throw err;
  }
  rows.forEach((row) => {
    // console.log(row);
  });
});

//Home page route
app.get("/", (req, res) => {
  res.send("You have landed on Home page of server");
});


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
