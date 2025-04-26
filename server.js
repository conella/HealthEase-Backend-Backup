// server.js
/* eslint-disable no-unused-vars */
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { Pool } from "pg";

import departmentsRoutes from "./routes/departments.js";
import doctorsRoutes from "./routes/doctors.js";
import appointmentsRouter from "./routes/appointments.js";
import checkappointments from "./routes/checkappointments.js";
import doctorleaves from "./routes/doctorleaves.js";
import checkdoctorleaves from "./routes/checkdoctorleave.js";
import showleavedays from "./routes/showleavedays.js";
import updatenotes from "./routes/updatenotes.js";


const app = express();
const port = process.env.PORT || 5000;
const env = process.env.NODE_ENV;
const isProductionLike = env === "production" || env === "staging";

console.log(`Running in ${env} mode`);
console.log(`isProductionLike: ${isProductionLike}`);

// Middleware
app.use(express.json());
const allowedOrigins = [
  "http://localhost:5173",
  "https://staging-healthease.vercel.app",
  "https://healthease-frontend.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(cookieParser());

// PostgreSQL setup
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Routes
app.use("/api/departments", departmentsRoutes);
app.use("/api/doctors", doctorsRoutes);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/checkappointments", checkappointments);
app.use("/api/doctorleaves", doctorleaves);
app.use("/api/checkdoctorleaves", checkdoctorleaves);
app.use("/api/showleavedays", showleavedays);
app.use("/api/updatenotes", updatenotes);

// JWT config

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Token functions
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

// DB Connection test
pool
  .connect()
  .then(() => console.log("Connected to PostgreSQL DB!"))
  .catch((err) => console.error("Database connection failed:", err));

// --- AUTH ROUTES ---

app.post("/register", async (req, res) => {
  const {
    username,
    password,
    firstName,
    lastName,
    role,
    email,
    departmentId,
    phoneNumber,
  } = req.body;

  const userRole = role || "patient";

  if (userRole === "doctor" && !departmentId) {
    return res.status(400).json({
      message: "Department ID is required when registering a doctor",
    });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    if (result.rows.length > 0) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertUserQuery = `
      INSERT INTO users (username, password, firstName, lastName, role, email, phoneNumber)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    const insertUserResult = await pool.query(insertUserQuery, [
      username,
      hashedPassword,
      firstName,
      lastName,
      userRole,
      email,
      phoneNumber,
    ]);
    const newUserId = insertUserResult.rows[0].id;

    if (userRole === "doctor") {
      await pool.query(
        "INSERT INTO doctors (departmentId, userId) VALUES ($1, $2)",
        [departmentId, newUserId]
      );
    }

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Database error" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

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
      secure: isProductionLike,
      sameSite: isProductionLike ? "None" : "Lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProductionLike,
      sameSite: isProductionLike ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ message: "Login successful", user: userPayload });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
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
      secure: isProductionLike,
      sameSite: isProductionLike ? "None" : "Lax",
      maxAge: 15 * 60 * 1000,
    });

    res.json({ message: "Token refreshed" });
  } catch (err) {
    return res.status(403).json({ message: "Invalid refresh token" });
  }
});

app.get("/protected", authenticateToken, (req, res) => {
  res.json({ message: "Protected content", user: req.user });
});

app.get("/me", (req, res) => {
  const token = req.cookies.accessToken;

  if (!token) return res.status(401).json({ message: "Not authenticated" });

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

// Start server
const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

export { app, server };
