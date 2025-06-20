const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const connection = require("./config/dbmysql");
const formatDate = require("./utils/formatDate");
const app = express();

// Middleware
app.use(express.json()); 
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// Routers
const misUserRouter = require("./routes/misUserRoutes");
const templateRouter = require("./routes/templateRoutes");
const playerRouter = require("./routes/playerRoutes");
const metricRouter = require("./routes/metricRoutes");
const gameRouter = require("./routes/gameRoutes");
const clientRouter = require("./routes/clientsRoutes");

app.use("/", misUserRouter);
app.use("/", templateRouter);
app.use("/", playerRouter);
app.use("/", metricRouter);
app.use("/", gameRouter);
app.use("/", clientRouter);

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL as id ' + connection.threadId);
});

// Function to delete obsolete sessions after 30 minutes
function deleteAllObsoleteSessions() {
  console.log("DELETING obsolete sessions at", new Date());

  const currentDateObj = new Date();
  const query = 'SELECT SESSION_ID, LOGIN_TIME_STAMP FROM PLAYER_SESSION_DETAILS';

  connection.query(query, (err, sessions) => {
    if (err) {
      console.error("Error fetching session details", err);
      return;
    }

    const obsoleteIds = sessions
      .filter((row) => {
        const loginTime = new Date(row.LOGIN_TIME_STAMP);
        const diffInMinutes = Math.floor((currentDateObj - loginTime) / (1000 * 60));
        return diffInMinutes > 30;
      })
      .map((row) => `'${row.SESSION_ID}'`);

    if (obsoleteIds.length === 0) {
      console.log("No obsolete sessions to delete");
      return;
    }

    const deleteQuery = `DELETE FROM PLAYER_SESSION_DETAILS WHERE SESSION_ID IN (${obsoleteIds.join(",")})`;

    connection.query(deleteQuery, (err) => {
      if (err) {
        console.error("Error deleting obsolete sessions:", err);
        return;
      }
      console.log("All obsolete sessions deleted");
    });
  });
}

// Schedule deletion every 10 minutes
setInterval(deleteAllObsoleteSessions, 600000);

// Health check route
app.get("/", (req, res) => {
  console.log("Home page API hit");
  res.send("You have landed on Home page of server");
});

// Test route
app.get("/mysql/test", (req, res) => {
  const query = `SELECT * FROM PLAYER_HISTORY`;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching data:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json(results);
  });
});

app.get("/test-db", (req, res) => {
  connection.query("SHOW TABLES", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Start server
app.listen("3500", () => {
  console.log("Server listening on Port 3500");
});
