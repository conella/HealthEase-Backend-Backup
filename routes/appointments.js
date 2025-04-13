import express from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";

const router = express.Router();

// Middleware: JWT auth
function authenticateToken(req, res, next) {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  const secret = process.env.JWT_SECRET || "supersecret";

  jwt.verify(token, secret, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
}

// Book an appointment
router.post("/", authenticateToken, async (req, res) => {
  const { doctorId, appointmentDate, appointmentTime } = req.body;
  const patientId = req.user.id;

  try {
    await pool.query(
      `
      INSERT INTO appointments (patientId, doctorId, appointmentDate, appointmentTime, status)
      VALUES ($1, $2, $3, $4::time, $5)
    `,
      [patientId, doctorId, appointmentDate, appointmentTime, "booked"]
    );

    res.status(201).json({ message: "Appointment booked successfully!" });
  } catch (err) {
    console.error("Error booking appointment:", err);
    res.status(500).json({ error: "Failed to book appointment" });
  }
});

// Get all appointments for logged-in patient
router.get("/", authenticateToken, async (req, res) => {
  const patientId = req.user.id;

  try {
    const result = await pool.query(
      `
      SELECT 
        a.id, a.appointmentDate, 
        TO_CHAR(a.appointmentTime, 'HH24:MI:SS') AS appointmentTime,
        a.status,
        u.firstName || ' ' || u.lastName AS doctorName,
        dep.name AS department
      FROM appointments a
      JOIN doctors d ON a.doctorId = d.id
      JOIN departments dep ON d.departmentId = dep.id
      JOIN users u ON d.userId = u.id
      WHERE a.patientId = $1
    `,
      [patientId]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching appointments:", err);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

// Get appointments for a specific patient
router.get("/:id", authenticateToken, async (req, res) => {
  const loggedInPatientId = req.user.id;
  const patientId = parseInt(req.params.id);

  if (loggedInPatientId !== patientId) {
    return res.status(403).json({ error: "Unauthorized access." });
  }

  try {
    const result = await pool.query(
      `
      SELECT 
        a.id, a.appointmentDate, 
        TO_CHAR(a.appointmentTime, 'HH24:MI:SS') AS appointmentTime,
        a.status,
        u.firstName || ' ' || u.lastName AS doctorName,
        dep.name AS department
      FROM appointments a
      JOIN doctors d ON a.doctorId = d.id
      JOIN departments dep ON d.departmentId = dep.id
      JOIN users u ON d.userId = u.id
      WHERE a.patientId = $1
    `,
      [patientId]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching appointments:", err);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

// Cancel appointment (update status to 'canceled')
router.put("/:id/cancel", authenticateToken, async (req, res) => {
  const patientId = req.user.id;
  const appointmentId = req.params.id;

  try {
    // Check if the appointment exists for the logged-in patient
    const check = await pool.query(
      `SELECT * FROM appointments WHERE id = $1 AND patientId = $2`,
      [appointmentId, patientId]
    );

    if (check.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Appointment not found or unauthorized." });
    }

    // Update the status to 'canceled' instead of deleting the appointment
    await pool.query(
      `UPDATE appointments SET status = 'canceled' WHERE id = $1`,
      [appointmentId]
    );

    res.status(200).json({ message: "Appointment canceled successfully!" });
  } catch (err) {
    console.error("Error canceling appointment:", err);
    res.status(500).json({ error: "Failed to cancel appointment" });
  }
});

// Reschedule appointment
router.put("/:id", authenticateToken, async (req, res) => {
  const patientId = req.user.id;
  const appointmentId = req.params.id;
  const { newAppointmentDate, newAppointmentTime } = req.body;

  try {
    const existing = await pool.query(
      `SELECT * FROM appointments WHERE id = $1 AND patientId = $2`,
      [appointmentId, patientId]
    );

    if (existing.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Appointment not found or unauthorized." });
    }

    const doctorId = existing.rows[0].doctorid;

    const conflict = await pool.query(
      `
      SELECT * FROM appointments
      WHERE doctorId = $1 AND appointmentDate = $2 AND appointmentTime = $3::time
    `,
      [doctorId, newAppointmentDate, newAppointmentTime]
    );

    if (conflict.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Time slot already booked for this doctor." });
    }

    // Combined update in a single query for both time and status change
    await pool.query(
      `UPDATE appointments
   SET appointmentDate = $1, appointmentTime = $2::time, status = 'rescheduled'
   WHERE id = $3`,
      [newAppointmentDate, newAppointmentTime, appointmentId]
    );

    res.status(200).json({ message: "Appointment rescheduled successfully!" });
  } catch (err) {
    console.error("Error rescheduling appointment:", err);
    res.status(500).json({ error: "Failed to reschedule appointment" });
  }
});

export default router;
