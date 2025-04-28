import express from "express";
import pool from "../db.js"; // Assuming you already have db.js for PostgreSQL connection

const router = express.Router();

// 1. Get Doctor's Availability
router.get("/availability/:doctorId", async (req, res) => {
  const { doctorId } = req.params;
  try {
    const result = await pool.query(
      "SELECT id, dayofweek, starttime, endtime FROM doctoravailability WHERE doctorid = $1 ORDER BY dayofweek",
      [doctorId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching doctor availability:", err);
    res.status(500).json({ error: "Failed to fetch doctor availability" });
  }
});

// 2. Set/Add Doctor's Availability
router.post("/availability", async (req, res) => {
  const { doctorId, day, startTime, endTime } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO doctoravailability (doctorid, dayofweek, starttime, endtime)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [doctorId, day, startTime, endTime]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error setting doctor availability:", err);
    res.status(500).json({ error: "Failed to set doctor availability" });
  }
});

// 3. Update Doctor's Availability
router.put("/availability/:id", async (req, res) => {
  const { id } = req.params;
  const { day, startTime, endTime } = req.body;
  try {
    const result = await pool.query(
      `UPDATE doctoravailability 
       SET dayofweek = $1, starttime = $2, endtime = $3
       WHERE id = $4
       RETURNING *`,
      [day, startTime, endTime, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Availability not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error updating doctor availability:", err);
    res.status(500).json({ error: "Failed to update doctor availability" });
  }
});

// 4. Delete Doctor's Availability
router.delete("/availability/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM doctoravailability WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Availability not found" });
    }
    res.status(200).json({ message: "Doctor availability deleted successfully" });
  } catch (err) {
    console.error("Error deleting doctor availability:", err);
    res.status(500).json({ error: "Failed to delete doctor availability" });
  }
});

export default router;
