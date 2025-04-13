const express = require("express");
const router = express.Router();
const sql = require("mssql");

// Middleware to check authentication
function authenticateToken(req, res, next) {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  const jwt = require("jsonwebtoken");
  const secret = process.env.JWT_SECRET || "supersecret";

  jwt.verify(token, secret, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
}

router.post("/", authenticateToken, async (req, res) => {
  const { doctorId, appointmentDate, appointmentTime } = req.body;
  const patientId = req.user.id;

  try {
    const request = new sql.Request();

    console.log("Appointment time received:", appointmentTime);

    // Ensure the appointmentTime is a string, and log it
    const formattedAppointmentTime = appointmentTime.trim(); // trim any spaces
    console.log(
      "Received appointmentTime (as string):",
      formattedAppointmentTime
    );

    request
      .input("patientId", sql.Int, patientId)
      .input("doctorId", sql.Int, doctorId)
      .input("appointmentDate", sql.Date, appointmentDate)
      //   .input("appointmentTime", sql.Time, appointmentTime)
      .input("appointmentTime", sql.VarChar(8), formattedAppointmentTime) // Sending time as string (VARCHAR)
      .input("status", sql.VarChar(50), "booked");

    await request.query(`
        INSERT INTO appointments (patientId, doctorId, appointmentDate, appointmentTime, status)
        VALUES (@patientId, @doctorId, @appointmentDate, CAST(@appointmentTime AS TIME), @status)
      `);

    res.status(201).json({ message: "Appointment booked successfully!" });
  } catch (err) {
    console.error("Error booking appointment:", err);
    res.status(500).json({ error: "Failed to book appointment" });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  const patientId = req.user.id;

  try {
    const request = new sql.Request();

    // Declare the patientId parameter
    request.input("patientId", sql.Int, patientId);

    const result = await request.query(`
          SELECT a.id, a.appointmentDate, 
                 CONVERT(VARCHAR(8), a.appointmentTime, 108) AS appointmentTime, -- Explicitly convert time to string
                 a.status,
                 u.firstName + ' ' + u.lastName AS doctorName,  
                 dep.name AS department
          FROM appointments a
          JOIN doctors d ON a.doctorId = d.id
          JOIN departments dep ON d.departmentId = dep.id
          JOIN users u ON d.userId = u.id  
          WHERE a.patientId = @patientId
      `);

    // Now 'appointmentTime' is already a string in 'HH:MM:SS' format
    const appointments = result.recordset.map((appointment) => {
      const appointmentTime = appointment.appointmentTime;

      // Optionally trim any spaces, but it should already be clean
      const formattedAppointmentTime = appointmentTime
        ? appointmentTime.trim()
        : "";

      return {
        ...appointment,
        appointmentTime: formattedAppointmentTime, // Send as string
      };
    });

    res.status(200).json(appointments);
  } catch (err) {
    console.error("Error fetching appointments:", err);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

router.get("/:id", authenticateToken, async (req, res) => {
  const loggedInPatientId = req.user.id; // Patient's ID from the JWT token
  const patientId = parseInt(req.params.id); // Patient's ID from URL parameter

  // Check if the logged-in user is trying to access their own appointments
  if (loggedInPatientId !== patientId) {
    return res
      .status(403)
      .json({ error: "You can only access your own appointments." });
  }

  try {
    const request = new sql.Request();

    // Declare the patientId parameter
    request.input("patientId", sql.Int, patientId);

    // Query to fetch appointments for the specific patient
    const result = await request.query(`
          SELECT a.id, a.appointmentDate, a.appointmentTime, a.status,
            u.firstName + ' ' + u.lastName AS doctorName,  -- Fetch doctor's name from 'users' table
            dep.name AS department
          FROM appointments a
          JOIN doctors d ON a.doctorId = d.id
          JOIN departments dep ON d.departmentId = dep.id
          JOIN users u ON d.userId = u.id  -- Join with 'users' table to get doctor's name
          WHERE a.patientId = @patientId
        `);

    // Format the appointmentTime as a string
    const appointments = result.recordset.map((appointment) => {
      const appointmentTime = appointment.appointmentTime;

      // Ensure appointmentTime is a string and trim any spaces
      const formattedAppointmentTime = appointmentTime
        ? appointmentTime.toString().trim()
        : "";

      return {
        ...appointment,
        appointmentTime: formattedAppointmentTime, // Send as string
      };
    });

    res.status(200).json(appointments); // Return the list of appointments
  } catch (err) {
    console.error("Error fetching appointments:", err);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

// Cancel an Appointment
router.delete("/:id", authenticateToken, async (req, res) => {
    const patientId = req.user.id;  // Get the patient ID from the token
    const appointmentId = req.params.id; // Get the appointment ID from the URL
    
    try {
      // Check if the appointment exists and if it's booked by the logged-in patient
      const result = await new sql.Request()
        .input("appointmentId", sql.Int, appointmentId)
        .input("patientId", sql.Int, patientId)
        .query(`
          SELECT * FROM appointments
          WHERE id = @appointmentId AND patientId = @patientId
        `);
  
      // If no appointment is found or it doesn't belong to the patient, return an error
      if (result.recordset.length === 0) {
        return res.status(404).json({ error: "Appointment not found or you're not authorized to cancel it." });
      }
  
      // Proceed to delete the appointment
      await new sql.Request()
        .input("appointmentId", sql.Int, appointmentId)
        .query("DELETE FROM appointments WHERE id = @appointmentId");
  
      res.status(200).json({ message: "Appointment canceled successfully!" });
    } catch (err) {
      console.error("Error canceling appointment:", err);
      res.status(500).json({ error: "Failed to cancel appointment" });
    }
  });

  // Reschedule an Appointment
router.put("/:id", authenticateToken, async (req, res) => {
    const patientId = req.user.id;
    const appointmentId = req.params.id;
    const { newAppointmentDate, newAppointmentTime } = req.body;
  
    try {
      // Check if the appointment exists and if it's booked by the logged-in patient
      const result = await new sql.Request()
        .input("appointmentId", sql.Int, appointmentId)
        .input("patientId", sql.Int, patientId)
        .query(`
          SELECT * FROM appointments
          WHERE id = @appointmentId AND patientId = @patientId
        `);
  
      if (result.recordset.length === 0) {
        return res.status(404).json({ error: "Appointment not found or you're not authorized to reschedule it." });
      }
  
      // Check if the new time is available for the same doctor
      const doctorId = result.recordset[0].doctorId;  // Get the doctorId from the current appointment
      const timeConflict = await new sql.Request()
        .input("doctorId", sql.Int, doctorId)
        .input("newAppointmentDate", sql.Date, newAppointmentDate)
        .input("newAppointmentTime", sql.VarChar(8), newAppointmentTime)
        .query(`
          SELECT * FROM appointments
          WHERE doctorId = @doctorId
          AND appointmentDate = @newAppointmentDate
          AND appointmentTime = @newAppointmentTime
        `);
  
      if (timeConflict.recordset.length > 0) {
        return res.status(400).json({ error: "The new time is already booked by another patient." });
      }
  
      // Proceed to update the appointment
      await new sql.Request()
        .input("appointmentId", sql.Int, appointmentId)
        .input("newAppointmentDate", sql.Date, newAppointmentDate)
        .input("newAppointmentTime", sql.VarChar(8), newAppointmentTime)
        .query(`
          UPDATE appointments
          SET appointmentDate = @newAppointmentDate, appointmentTime = @newAppointmentTime
          WHERE id = @appointmentId
        `);
  
      res.status(200).json({ message: "Appointment rescheduled successfully!" });
    } catch (err) {
      console.error("Error rescheduling appointment:", err);
      res.status(500).json({ error: "Failed to reschedule appointment" });
    }
  });

module.exports = router;
