// server.js
require("dotenv").config(); // Loads environment variables from .env file
const cors = require("cors");
const express = require("express");
const bcrypt = require("bcrypt");
const sql = require("mssql");

const app = express();
const port = 5000;

app.use(express.json()); // Parse JSON body

app.use(cors());

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
    // Query user from the database
    const result =
      await sql.query`SELECT * FROM users WHERE username = ${username}`;

    if (result.recordset.length > 0) {
      const user = result.recordset[0];

      // Compare provided password with hashed password in DB
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (isValidPassword) {
        // ✅ Return only safe user info (exclude password)
        res.status(200).json({
          message: "Login successful",
          user: {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
        });
      } else {
        res.status(401).json({ message: "Invalid username or password" });
      }
    } else {
      res.status(401).json({ message: "Invalid username or password" });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
