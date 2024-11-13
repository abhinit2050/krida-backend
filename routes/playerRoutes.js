const express = require("express");
const playerRouter = express.Router();

const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");
const formatDate = require("../utils/formatDate");
const moment = require("moment");


//GET Ip address of the player
playerRouter.get('/fetchip', async (req, res) => {
  
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
playerRouter.get("/playerdupcheck",(req, res)=>{

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

});

//login API for player- Client IP 
playerRouter.post("/loginPlayerip", (req, res) => {
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
playerRouter.post("/loginPlayerCredentials", (req, res) => {
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
playerRouter.post("/logoutPlayer", (req, res) => {
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
    
//Create a new Player
playerRouter.post("/addPlayer", (req, res) => {
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
playerRouter.post("/updatePlayer",(req,res)=>{

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

    
module.exports = playerRouter;