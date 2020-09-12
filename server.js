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
  origin: isProduction ? "https://justsomenotes.com" : "*",
};

var whitelist = ["https://justsomenotes.com", "www.justsomenotes.com"];
var corsOptions = {
  origin: isProduction
    ? function (origin, callback) {
        if (whitelist.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      }
    : "*",
};

app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 5 requests,
});

app.use(limiter);

function sameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getWeek(current) {
  var week = new Array();
  // Starting Monday not Sunday
  current.setDate(current.getDate() - current.getDay() + 1);
  for (var i = 0; i < 7; i++) {
    week.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return week;
}

const getStats = async (request, response) => {
  const startDate = new Date(Number(request.params.startDate));

  console.log(startDate);

  let totalVisits;
  const totalVisitsQuery = {
    text: "SELECT COUNT(*) FROM visits",
  };

  let totalUniqueVisits;
  const totalUniqueVisitsQuery = {
    text: "SELECT COUNT ( DISTINCT Visitorid ) FROM visits",
  };

  let visitsThisWeek = [];
  let totalVisitsThisWeek;
  const visitsThisWeekQuery = {
    text:
      "SELECT Timestamp FROM visits WHERE Timestamp BETWEEN '2020-01-01' AND '2020-10-10'",
  };

  let topCountries;
  const topCountriesQuery = {
    text:
      "SELECT Country, COUNT( Country ) AS amount FROM visits GROUP BY Country ORDER BY amount DESC LIMIT 3",
  };

  const client = await pool.connect();
  try {
    const tvResult = await client.query(totalVisitsQuery);
    const tuvResult = await client.query(totalUniqueVisitsQuery);
    const vtwResult = await client.query(visitsThisWeekQuery);
    const tcResult = await client.query(topCountriesQuery);

    totalVisits = tvResult.rows[0].count;
    totalUniqueVisits = tuvResult.rows[0].count;
    totalVisitsThisWeek = vtwResult.rows.length;

    const week = getWeek(startDate);

    visitsThisWeek = week.map((date) => {
      const isDate = vtwResult.rows.filter((row) => {
        if (row.timestamp) {
          return sameDay(date, row.timestamp);
        } else {
          return false;
        }
      });

      const dateTimeFormat = new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
      const [
        { value: month },
        { value: day },
        { value: year },
      ] = dateTimeFormat.formatToParts(date);

      return { date: `${day}-${month}-${year}`, amount: isDate.length };
    });

    topCountries = tcResult.rows;

    response.status(200).json({
      totalVisits,
      totalUniqueVisits,
      totalVisitsThisWeek,
      visitsThisWeek,
      topCountries,
    });
  } catch (e) {
    console.error(e.stack);
  } finally {
    client.release();
  }
};

const addVisit = (request, response) => {
  const {
    page = "Unknown",
    browser = "Unknown",
    language = "Unknown",
    referrer = "Unknown",
    dimensions = "Unknown",
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
    ? require("crypto").createHash("md5").update(ip).digest("hex")
    : "Unknown";

  const timestamp = new Date().toISOString();

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
      timestamp,
    ],
    (error) => {
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

app.route("/stats").post(addVisit);

app.route("/stats/:startDate").get(getStats);

app.listen(process.env.PORT || 8002, () => {
  console.log(`Server listening`);
});
