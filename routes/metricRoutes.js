const express = require("express");

const metricRouter = express.Router();

const db = require("../config/database");
const connection = require("../config/dbmysql")
const { v4: uuidv4 } = require("uuid");
const formatDate = require("../utils/formatDate");
const moment = require("moment");
const {authMisUser} = require("../middlewares/authMW");


function convertToCompactTimestamp(dateStr) {
    // Input: '16-03-2025T16:00:58'
    const [datePart, timePart] = dateStr.split('T');
    const [day, month, year] = datePart.split('-');
    const compact = `${year}${month}${day}${timePart.replace(/:/g, '')}`;
    return compact; // Output: '20250316160058'
  }

//through authMisUser, we are able to fetch the user => we have the client id of the user. 
// This client id may be used for filterting the results

//fetch data of all active players
metricRouter.get("/fetchActivePlayers", authMisUser, (req, res) => {

    let active_player_count;
    let todayDate = new Date();
    todayDate = formatDate(todayDate);
   todayDate = (todayDate.split(' ')[0]);

    let existing_players =[]
  
    const queryToFetchActivePlayers = 'SELECT SUBSTR(LOGIN_TIME_STAMP, 1, 10) AS date_only, GAME_PLAYED, PLATFORM, PLAYERID FROM PLAYER_HISTORY';
  
    connection.query(queryToFetchActivePlayers,(err, resultActive) => {
      if (err) {
        res.status(500).send("Error " + err);
        return;
      }
  
      let temp_activePlayer_array = [];
      let final_activePlayer_array=[];
      
    temp_activePlayer_array   =   resultActive.filter((item, index) => {

        return item.date_only === todayDate

    });
    
          
     temp_activePlayer_array.map((item)=> {
                
            if(!(existing_players.includes(item.PLAYERID))){
                        existing_players.push(item.PLAYERID)
                        final_activePlayer_array.push(item);
                     }
        });

     const activePlayersCount = {
          "active_players":active_player_count
     }
      
      res.status(201).json(final_activePlayer_array);
    });
  });
  
  //fetch Active duration of all the players
metricRouter.get("/active_duration_all", authMisUser, (req, res) => {
// Query the database to get playerID and login_time_stamp
connection.query(
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
metricRouter.get("/total_player_count", authMisUser, (req, res) => {
connection.query(
    "SELECT count(*) AS total_player_count from PLAYERS",
    (err, resCount) => {
    if (err) {
        res.status(500).json({ error: err.message });
        return;
    }

    res.status(200).json({ count: resCount[0].total_player_count });
    }
);
});


//fetch details of all the games played between 2 dates (both inclusive)
metricRouter.get("/game_total_count", authMisUser, (req, res) => {
// Extract the from date and to date from the query parameters
const fromDate = new Date(req.query.fromDate);
const toDate = new Date(req.query.toDate);

// Query to get the count of players registered between the from date and to date
const queryToFetchGameTotalCount =
    "SELECT COUNT(*) AS game_total_count FROM PLAYER_HISTORY WHERE GAME_PLAYED IS NOT NULL AND LOGIN_TIME_STAMP BETWEEN ? AND ?";

// Execute the query with the fromDate and toDate as parameters
connection.query(queryToFetchGameTotalCount, [fromDate, toDate], (err, row) => {
    if (err) {
    return res.status(500).json({ error: err.message });
    }
    //generate result
    const REALTIME_CARD_DATA = [
    {
        metric: "Game Total Count",
        metricValue: row[0].game_total_count,
        percentage: null,
    },
    ];

    // Return the count of players registered between the from date and to date
    res.json(REALTIME_CARD_DATA);
});
});

//fetch total duration of game played between 2 dates (both inclusive)
metricRouter.get("/total_time_played", authMisUser, (req, res) => {
    // Extract the from date and to date from the query parameters
    const fromDate = new Date(req.query.fromDate);
    const toDate = new Date(req.query.toDate);
    
    // Query to get the count of players registered between the from date and to date
    const queryToFetchTotalTimePlayed =
        "SELECT SUM(ACTIVE_DURATION) AS total_duration FROM PLAYER_HISTORY WHERE GAME_PLAYED != 'NA' AND LOGIN_TIME_STAMP BETWEEN ? AND ?";
    
    // Execute the query with the fromDate and toDate as parameters
    connection.query(queryToFetchTotalTimePlayed, [fromDate, toDate], (err, row) => {
        if (err) {
        return res.status(500).json({ error: err.message });
        }
        //generate result

        console.log("row", row);
        const REALTIME_CARD_DATA = [
        {
            metric: "Total Time Played",
            metricValue: row,
            percentage: null,
        },
        ];
    
        // Return the count of players registered between the from date and to date
        res.json(REALTIME_CARD_DATA);
    });
    });
  
//fetch unique players who played between 2 dates (both inclusive)
metricRouter.get("/unique_player_count", authMisUser, (req, res) => {
// Extract the from date and to date from the query parameters
const fromDate = new Date(req.query.fromDate);
const toDate = new Date(req.query.toDate);

//query to get the count of unique players between the dates
const queryToFetchUniquePlayers = `SELECT COUNT(DISTINCT PLAYERID) AS total_unique_players FROM PLAYER_HISTORY
WHERE LOGIN_TIME_STAMP BETWEEN ? AND ?;`;

connection.query(queryToFetchUniquePlayers, [fromDate, toDate], (err, row) => {
    if (err) {
    console.error(err.message);
    return;
    }
    console.log("Total unique players:", row[0].total_unique_players);
    res.status(201).send(row);
});
});
  
//fetch the count of players registered between 2 dates (both inclusive) 
metricRouter.get("/new_player_count", authMisUser, (req, res) => {

    // Extract the from date and to date from the query parameters
let fromDate = new Date(req.query.fromDate);
let toDate = new Date(req.query.toDate);

const queryToFetchNewPlayers =
`SELECT 
  PLAYERID,
  ANY_VALUE(id) AS id,
  ANY_VALUE(PRIMARY_REGISTRATION_DATE) AS PRIMARY_REGISTRATION_DATE,
  ANY_VALUE(GAME_PLAYED) AS GAME_PLAYED,
  ANY_VALUE(CONTACT) AS CONTACT
FROM PLAYER_HISTORY
WHERE PRIMARY_REGISTRATION_DATE BETWEEN ? AND ?
GROUP BY PLAYERID;`



// Execute the query with the fromDate and toDate as parameters
connection.query(queryToFetchNewPlayers, [fromDate, toDate],(errNew, rowNew) => {
    if (errNew) {
    console.log(errNew);
    return res.status(500).json({ error: errNew.message });
    }
    console.log(rowNew);
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


//fetch results for new player registrations for last 7 periods based on date ranges received
metricRouter.post("/unique_player_count/bulk", authMisUser, async (req, res) => {
    const dateRanges = req.body.dateRanges;
  
    if (!Array.isArray(dateRanges) || dateRanges.length !== 7) {
      return res.status(400).json({ error: "Please provide exactly 7 date ranges." });
    }
  
    const queryToFetchNewPlayers = `
        SELECT 
      PLAYERID,
      ANY_VALUE(id) AS id,
      ANY_VALUE(PRIMARY_REGISTRATION_DATE) AS PRIMARY_REGISTRATION_DATE,
      ANY_VALUE(GAME_PLAYED) AS GAME_PLAYED,
      ANY_VALUE(CONTACT) AS CONTACT
    FROM PLAYER_HISTORY
    WHERE PRIMARY_REGISTRATION_DATE BETWEEN ? AND ? GROUP BY PLAYERID;`
  
    try {
      const results = await Promise.all(
        dateRanges.map(({ fromDate, toDate }) => {
            let fromDateNew = new Date(fromDate);
            let toDateNew = new Date(toDate);

          return new Promise((resolve, reject) => {
            connection.query(queryToFetchNewPlayers, [fromDateNew, toDateNew], (err, rows) => {
              if (err) {
                return reject(err);
              }
              resolve(rows.length); // Only return the metricValue
            });
          });
        })
      );
  
      res.json(results); // Array of 7 numbers
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch data for one or more date ranges." });
    }
  });


const parseToSqliteDate = (input) => {
  // Convert DD-MM-YYYYTHH:mm:ss to YYYY-MM-DD HH:mm:ss
  const [datePart, timePart] = input.split("T");
  const [day, month, year] = datePart.split("-");
  return `${year}-${month}-${day} ${timePart}`;
};


//modified returning player count
metricRouter.get("/ret_player_count", (req, res) => {
  // Extract the fromDate and toDate from query parameters
//  let fromDate = parseToSqliteDate(req.query.fromDate);
// let toDate = parseToSqliteDate(req.query.toDate);

let fromDate = new Date (req.query.fromDate);
let toDate = new Date (req.query.toDate);

console.log(fromDate, toDate);

  // Validate inputs (optional but good practice)
  if (!fromDate || !toDate) {
    return res.status(400).json({ error: "Missing fromDate or toDate" });
  }

  // Query: select unique PLAYERIDs whose login is in range and after registration
  const queryTofetchReturnPlayers = `SELECT PLAYERID FROM PLAYER_HISTORY WHERE LOGIN_TIME_STAMP BETWEEN ? AND ?
  AND LOGIN_TIME_STAMP > PRIMARY_REGISTRATION_DATE GROUP BY PLAYERID;`;

  connection.query(queryTofetchReturnPlayers, [fromDate, toDate], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    console.log("r",rows);
    // Count of unique returning players
    const returningPlayerCount = rows.length;

    const REALTIME_CARD_DATA = [
      {
        metric: "Returning Players",
        metricValue: returningPlayerCount,
        percentage: null,
      },
    ];

    res.json(REALTIME_CARD_DATA);
  });
});

  
//average playing time for a game between two dates
metricRouter.get("/averagePlayTime", (req, res) => {
const {GAME_PLAYED} = req.query;
const  fromDate = new Date(req.query.fromDate);
const  toDate = new Date(req.query.toDate);

// Fetch the rows from PLAYER_HISTORY for the specified game and date range
connection.query(`SELECT ACTIVE_DURATION FROM PLAYER_HISTORY WHERE GAME_PLAYED = ? AND LOGIN_TIME_STAMP BETWEEN ? AND ?`, 
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


// Extract the from date and to date from the query parameters
const fromDate = new Date(req.query.fromDate);
const toDate = new Date(req.query.toDate);

let game_count_total;
let player_count_total;

// Query to get the count of total sessions by all players combined between the from date and to date
const queryToFetchGameTotalCount =
    "SELECT COUNT(*) AS game_count_total_query FROM PLAYER_HISTORY WHERE GAME_PLAYED <> 'NA' AND LOGIN_TIME_STAMP BETWEEN ? AND ?";

// Execute the query with the fromDate and toDate as parameters
connection.query(queryToFetchGameTotalCount, [fromDate, toDate], (err, row) => {
    if (err) {
    return res.status(500).json({ error: err.message });
    }

    game_count_total = row[0].game_count_total_query;

    //now find the distinct count of the players who played these games
    const queryTofetchDistinctPlayerCount = `SELECT COUNT(DISTINCT PLAYERID) AS distinct_players_count
    FROM PLAYER_HISTORY WHERE GAME_PLAYED <> 'NA' AND LOGIN_TIME_STAMP BETWEEN ? AND ?`;

    connection.query(queryTofetchDistinctPlayerCount, [fromDate, toDate], (errPlCount, rowPlCount)=>{
    if(errPlCount){
        return res.status(500).json({ error: err.message });
    }
    player_count_total = rowPlCount[0].distinct_players_count;

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

//Total number of sessions played per player - PENDING
metricRouter.get("/sessions_per_player",(req, res)=>{

      // Extract the from date and to date from the query parameters
    const fromDate = new Date(req.query.fromDate);
    const toDate = new Date(req.query.toDate);

    // Query to get the count of total sessions by all players combined between the from date and to date; one session = 60 seconds

    const queryToFetchTotalSessionCount =
    `SELECT CAST((SUM(IFNULL(ACTIVE_DURATION, 0)) + 59) / 30 AS SIGNED) AS total_minutes, COUNT(*) AS total_rows 
      FROM PLAYER_HISTORY WHERE LOGIN_TIME_STAMP BETWEEN ? AND ?;`

// Execute the query with the fromDate and toDate as parameters
connection.query(queryToFetchTotalSessionCount, [fromDate, toDate], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const { total_minutes, total_rows } = row[0];

    if (total_rows === 0) {
      return res.status(200).json({
        message: 'No records found in the given range.',
        average: 0,
      });
    }

    const average = total_minutes / total_rows;

    res.status(200).json({
      totalSessions: total_minutes,
      totalPlayers: total_rows,
      averageSessionPerPlayer: average,
    });
  });

})
  
  
//Individual game counts for a specified date range
metricRouter.get("/each_game_count",(req,res)=>{

const fromDate = new Date(req.query.fromDate);
const toDate = new Date(req.query.toDate);

const queryToFetchEachGameCount = `SELECT GAME_PLAYED AS game_name, COUNT(GAME_PLAYED) AS game_count FROM PLAYER_HISTORY
WHERE LOGIN_TIME_STAMP BETWEEN ? AND ? GROUP BY GAME_PLAYED`;

connection.query(queryToFetchEachGameCount,[fromDate, toDate],(errGame,rowsGame)=>{
    if(errGame){
        return res.status(500).json({ error: errGame.message });
    }
    res.status(202).json(rowsGame);
})
})

//conversion count for a specified date range
metricRouter.get("/conversion_count", (req, res) => {
    const fromDate = new Date(req.query.fromDate);
    const toDate = new Date(req.query.toDate);

    

    console.log(fromDate, "and",toDate)

    if (!fromDate || !toDate) {
        return res.status(400).json({ error: "fromDate and toDate are required" });
    }

    const query = `SELECT COUNT(*) AS conversion_count
        FROM PLAYERS
        WHERE Primary_Registration_Date BETWEEN ? AND ?
        AND (
            (EMAIL_ID IS NOT NULL AND EMAIL_ID != '')
            OR
            (contact IS NOT NULL AND contact != '')
        )`;

    connection.query(query, [fromDate, toDate], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(200).json(row[0]); // returns { conversion_count: <number> }
    });
});

//conversion rate for a specified date range
metricRouter.get("/conversion_rate", (req, res) => {
    const fromDate = new Date(req.query.fromDate);
    const toDate = new Date(req.query.toDate);

    if (!fromDate || !toDate) {
        return res.status(400).json({ error: "fromDate and toDate are required" });
    }

    const totalQuery = `
        SELECT COUNT(*) AS total_count FROM PLAYERS WHERE Primary_Registration_Date BETWEEN ? AND ?`;

    const convertedQuery = `SELECT COUNT(*) AS converted_count FROM PLAYERS WHERE Primary_Registration_Date BETWEEN ? AND ?
        AND (
            (EMAIL_ID IS NOT NULL AND EMAIL_ID != '')
            OR
            (contact IS NOT NULL AND contact != '')
        )`;


    // First: get total count
    connection.query(totalQuery, [fromDate, toDate], (errTotal, totalRow) => {
        if (errTotal) {
            return res.status(500).json({ error: errTotal.message });
        }

        const totalCount = totalRow[0].total_count;

        // If no players found, return 0 to avoid division by zero
        if (totalCount === 0) {
            return res.status(200).json({ conversion_rate: 0 });
        }

        // Then: get count of players with email/contact
        connection.query(convertedQuery, [fromDate, toDate], (errConverted, convertedRow) => {
            if (errConverted) {
                return res.status(500).json({ error: errConverted.message });
            }

            const convertedCount = convertedRow[0].converted_count;
            const conversionRate = (convertedCount / totalCount)*100;
             console.log("total count and convert count", totalCount, convertedCount);

            res.status(200).json({ conversion_rate: conversionRate.toFixed(2) });
        });
    });
});


module.exports = metricRouter;