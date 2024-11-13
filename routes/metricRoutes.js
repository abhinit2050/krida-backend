const express = require("express");

const metricRouter = express.Router();

const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");
const formatDate = require("../utils/formatDate");
const moment = require("moment");


//fetch data of all active players
metricRouter.get("/fetchActivePlayers", (req, res) => {

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
metricRouter.get("/active_duration_all", (req, res) => {
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
metricRouter.get("/total_player_count", (req, res) => {
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
metricRouter.get("/game_total_count", (req, res) => {
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
metricRouter.get("/unique_player_count", (req, res) => {
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
metricRouter.get("/new_player_count", (req, res) => {
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
metricRouter.get("/ret_player_count",(req,res)=>{

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
metricRouter.get("/averagePlayTime", (req, res) => {
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
metricRouter.get("/games_per_player",(req,res)=>{

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
metricRouter.get("/each_game_count",(req,res)=>{

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

module.exports = metricRouter;