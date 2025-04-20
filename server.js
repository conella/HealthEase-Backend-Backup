// server.js
require("dotenv").config(); // Loads environment variables from .env file
const cors = require("cors");
const express = require("express");
const bcrypt = require("bcrypt");
const sql = require("mssql");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const port = 5000;

app.use(express.json()); // Parse JSON body

app.use(
  cors({
    origin: "http://localhost:5173", // frontend port
    credentials: true, // allow cookies
  })
);

app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "refreshsupersecret";

// Token generation helpers
function generateAccessToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "15m" }); // short-lived
}

function generateRefreshToken(user) {
  return jwt.sign(user, JWT_REFRESH_SECRET, { expiresIn: "7d" }); // longer-lived
}

function authenticateToken(req, res, next) {
  const token = req.cookies.accessToken;
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// SQL Server connection config
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false, // set to false for local dev
    trustServerCertificate: true, // Needed for local dev without SSL
  },
};

// Connect to the database
sql
  .connect(dbConfig)
  .then(() => console.log("Connected to the database!"))
  .catch((err) => console.error("Database connection failed:", err));

// Register route
app.post("/register", async (req, res) => {
  const { username, password, firstName, lastName, role } = req.body; // Accept the role

  // Default role to 'patient' if not provided
  const userRole = role || "patient"; // Default to 'patient' if no role is provided

  // Check if username already exists
  const result =
    await sql.query`SELECT * FROM users WHERE username = ${username}`;
  if (result.recordset.length > 0) {
    return res.status(400).json({ message: "Username already exists" });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert into the database, using the correct role
  const query = `
      INSERT INTO users (username, password, firstName, lastName, role)
      VALUES (@username, @password, @firstName, @lastName, @role)
    `;
  const request = new sql.Request();
  request
    .input("username", sql.NVarChar(255), username)
    .input("password", sql.NVarChar(255), hashedPassword)
    .input("firstName", sql.NVarChar(255), firstName)
    .input("lastName", sql.NVarChar(255), lastName)
    .input("role", sql.NVarChar(50), userRole); // Pass the role into the query

  try {
    await request.query(query);
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Database error" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result =
      await sql.query`SELECT * FROM users WHERE username = ${username}`;

    if (result.recordset.length > 0) {
      const user = result.recordset[0];
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (isValidPassword) {
        const userPayload = {
          id: user.id,
          username: user.username,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        };

        const accessToken = generateAccessToken(userPayload);
        const refreshToken = generateRefreshToken(userPayload);

        // Send tokens via cookies
        res.cookie("accessToken", accessToken, {
          httpOnly: true,
          secure: false, // true if using HTTPS
          sameSite: "lax",
          maxAge: 15 * 60 * 1000, // 15 minutes
        });

        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.json({ message: "Login successful", user: userPayload });
      } else {
        res.status(401).json({ message: "Invalid credentials" });
      }
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

app.post('/logout', (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out successfully" });
});

app.post("/refresh", (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken)
    return res.status(401).json({ message: "No refresh token" });

  try {
    const user = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    const newAccessToken = generateAccessToken(user);

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.json({ message: "Token refreshed" });
  } catch (err) {
    return res.status(403).json({ message: "Invalid refresh token" });
  }
});

// Example protected route
app.get("/protected", authenticateToken, (req, res) => {
  res.json({ message: "Protected content", user: req.user });
});

app.get("/me", (req, res) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  });
});

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

module.exports = { app, server };