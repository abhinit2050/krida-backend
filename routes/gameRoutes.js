const express = require("express");
const gameRouter = express.Router();
const db = require("../config/database");
const authMisUser = require("../middlewares/authMW.js")


gameRouter.post("/addGame", authMisUser, (req, res) => {
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


gameRouter.get("/allGames", authMisUser, (req, res)=>{

  try{
    const querytoFetchAllGames = `SELECT * FROM GAMES`;

    db.all(querytoFetchAllGames, (err, result)=>{
  
      if(err){
        res.status(500).send("Error fetching results! "+err);
      }
      else{
        res.json({
          message:"Results fetched!",
          data: result
        })
      }
    })
  }catch(err){
    res.status(500).send("Something went wrong! "+err);
  }
  
})

module.exports = gameRouter;