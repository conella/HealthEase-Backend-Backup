import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/doctors
// Optionally filter by departmentId
router.get("/", async (req, res) => {
  const { departmentId } = req.query;

  try {
    let query = `
      SELECT 
        d.id AS doctorId, d.departmentId,
        u.firstName, u.lastName, u.email
      FROM doctors d
      JOIN users u ON u.id = d.userId
    `;
    let params = [];

    if (departmentId) {
      query += " WHERE d.departmentId = $1";
      params.push(departmentId);
    }

    const result = await pool.query(query, params);
    res.json(
      result.rows.map((row) => ({
        id: row.doctorid, // 👈 now this matches appointments.doctorId FK
        firstname: row.firstname,
        lastname: row.lastname,
        email: row.email,
        departmentId: row.departmentid,
      }))
    );
  } catch (err) {
    console.error("Error fetching doctors:", err);
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

// Get all doctors with their details (name, contact info, and department)
router.get("/find-doctors", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        u.firstname || ' ' || u.lastname AS doctorName,
        u.email,
        u.phonenumber,
        d.name AS department
      FROM 
        doctors doc
      JOIN 
        users u ON doc.userid = u.id
      JOIN 
        departments d ON doc.departmentid = d.id;
      `
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching doctors:", err);
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

export default router;
