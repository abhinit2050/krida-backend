const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("MIS_Krida.db");

module.exports = db;