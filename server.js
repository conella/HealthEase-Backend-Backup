import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import bcrypt from "bcrypt";
import sql from "mssql";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
const port = 5000;

app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "refreshsupersecret";

// Token generation
function generateAccessToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "15m" });
}

function generateRefreshToken(user) {
  return jwt.sign(user, JWT_REFRESH_SECRET, { expiresIn: "7d" });
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

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

if (process.env.NODE_ENV !== "test") {
  sql
    .connect(dbConfig)
    .then(() => console.log("Connected to the database!"))
    .catch((err) => console.error("Database connection failed:", err));
}

app.post("/register", async (req, res) => {
  const { username, password, firstName, lastName, role } = req.body;
  const userRole = role || "patient";

  try {
    // Query the database to check if the username already exists
    const result = await sql.query`SELECT * FROM users WHERE username = ${username}`;

    if (result.recordset.length > 0) {
      // If username already exists, return a 400
      return res.status(400).json({ message: "Username already exists" });
    }

    // Hash password and insert into the database
    const hashedPassword = await bcrypt.hash(password, 10);
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
      .input("role", sql.NVarChar(50), userRole);

    await request.query(query);
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    // If any error occurs, return a 500 error
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

      try {
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (isValidPassword) {
          // Token generation logic
          const userPayload = {
            id: user.id,
            username: user.username,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
          };

          const accessToken = generateAccessToken(userPayload);
          const refreshToken = generateRefreshToken(userPayload);

          res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 15 * 60 * 1000,
          });

          res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });

          return res.json({ message: "Login successful", user: userPayload });
        } else {
          return res.status(401).json({ message: "Invalid credentials" });
        }
      } catch (err) {
        console.error("Password comparison error:", err);
        return res.status(500).json({ message: "Login failed" });
      }
    } else {
      return res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
});

app.post("/logout", (req, res) => {
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
    // eslint-disable-next-line no-unused-vars
  } catch (err) {
    return res.status(403).json({ message: "Invalid refresh token" });
  }
});

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

export { app, server };
