const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { pool } = require("./config");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { body, check } = require("express-validator");
const expressip = require("express-ip");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(compression());
app.use(helmet());
app.use(expressip().getIpInfoMiddleware);

const isProduction = process.env.NODE_ENV === "production";
const origin = {
  origin: isProduction ? "https://justsomenotes.com" : "*"
};

var whitelist = ["https://justsomenotes.com", "www.justsomenotes.com"];
var corsOptions = {
  origin: isProduction
    ? function(origin, callback) {
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
  max: 60 // 5 requests,
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
  const {
    page = "Unknown",
    browser = "Unknown",
    language = "Unknown",
    referrer = "Unknown",
    dimensions = "Unknown"
  } = request.body;

  const ip =
    request.headers["x-forwarded-for"] ||
    request.connection.remoteAddress ||
    request.socket.remoteAddress ||
    (request.connection.socket
      ? request.connection.socket.remoteAddress
      : null);

  const country = !request.ipInfo.error ? request.ipInfo.country : "Unknown";

  const visitorid = ip
    ? require("crypto")
        .createHash("md5")
        .update(ip)
        .digest("hex")
    : "Unknown";

  const timestamp = new Date().toISOString();
  console.log(
    page,
    country,
    language,
    browser,
    dimensions,
    referrer,
    visitorid,
    timestamp
  );
  pool.query(
    "INSERT INTO visits (page, country, language, browser, dimensions, referrer, visitorid, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [
      page,
      country,
      language,
      browser,
      dimensions,
      referrer,
      visitorid,
      timestamp
    ],
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
