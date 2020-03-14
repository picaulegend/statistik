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

app.use(cors(origin));

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

/*
language:
browser:
page: 

*/

const addVisit = (request, response) => {
  const { page, country } = request.body;

  const ip =
    request.headers["x-forwarded-for"] ||
    request.connection.remoteAddress ||
    request.socket.remoteAddress ||
    (request.connection.socket
      ? request.connection.socket.remoteAddress
      : null);

  console.log({ ip });

  pool.query(
    "INSERT INTO visits (page, country) VALUES ($1, $2)",
    [page, country],
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

app.listen(8002, () => {
  console.log("Example app listening on port 8000!");
});
