import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/:id", async (req, res) => {
  const doctorId = parseInt(req.params.id);
  const { startDate, endDate } = req.query; 

  try {
    let query = `
      SELECT 
        a.id, 
        a.appointmentdate, 
        TO_CHAR(a.appointmenttime, 'HH24:MI:SS') AS appointmenttime,
        a.status,
        u.firstName || ' ' || u.lastName AS patientName,
        dep.name AS department
      FROM appointments a
      JOIN users u ON a.patientid = u.id
      JOIN doctors d ON a.doctorid = d.id
      JOIN departments dep ON d.departmentid = dep.id
      WHERE a.doctorId = $1
    `;
    const params = [doctorId];

    // If startDate and endDate are provided, add to query
    if (startDate && endDate) {
      query += " AND a.appointmentdate BETWEEN $2 AND $3";
      params.push(startDate, endDate);
    }

    query += " ORDER BY a.appointmentdate, a.appointmenttime";

    const result = await pool.query(query, params);

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching doctor appointments:", err);
    res.status(500).json({ error: "Failed to fetch doctor appointments" });
  }
});

export default router;
