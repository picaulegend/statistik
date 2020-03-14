const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { pool } = require("./config");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { body, check } = require("express-validator");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(compression());
app.use(helmet());

const isProduction = process.env.NODE_ENV === "production";
const origin = {
  origin: isProduction ? "https://justsomenotes.com" : "*"
};

var whitelist = ["https://justsomenotes.com", "www.justsomenotes.com"];
var corsOptions = {
  origin: isProduction
    ? function(origin, callback) {
        console.log("ello", origin, whitelist);
        if (whitelist.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      }
    : "*"
};

app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5 // 5 requests,
});

app.use(limiter);

const getStats = (request, response) => {
  pool.query("SELECT * FROM visits", (error, results) => {
    if (error) {
      throw error;
    }
    response.status(200).json(results.rows);
  });
};

const addVisit = (request, response) => {
  const { page, browser, language, referrer } = request.body;

  const ip =
    request.headers["x-forwarded-for"] ||
    request.connection.remoteAddress ||
    request.socket.remoteAddress ||
    (request.connection.socket
      ? request.connection.socket.remoteAddress
      : null);

  const country = "Unknown";
  const visitorid = ip;

  pool.query(
    "INSERT INTO visits (page, country, language, browser, referrer, visitorid) VALUES ($1, $2, $3, $4, $5, $6)",
    [page, country, language, browser, referrer, visitorid],
    error => {
      if (error) {
        throw error;
      }
      response.status(201).json({ status: "success", message: "Visit added." });
    }
  );
};

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app
  .route("/stats")
  .get(getStats)
  .post(addVisit);

app.listen(process.env.PORT || 8002, () => {
  console.log(`Server listening`);
});
