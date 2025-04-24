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
        u.id, u.firstName, u.lastName, u.email, d.departmentId
      FROM users u
      JOIN doctors d ON u.id = d.userId
      WHERE u.role = 'doctor'
    `;
    let params = [];

    if (departmentId) {
      query += " AND d.departmentId = $1";
      params.push(departmentId);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching doctors:", err);
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

export default router;
