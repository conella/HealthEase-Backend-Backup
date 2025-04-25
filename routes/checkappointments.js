import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/:id", async (req, res) => {
  const doctorId = parseInt(req.params.id);

  try {
    const result = await pool.query(
      `
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
    ORDER BY a.appointmentdate, a.appointmenttime;
      `,
      [doctorId]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching doctor appointments:", err);
    res.status(500).json({ error: "Failed to fetch doctor appointments" });
  }
  
});
export default router;
