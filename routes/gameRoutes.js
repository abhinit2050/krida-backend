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


module.exports = gameRouter;