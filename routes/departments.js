import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET all departments
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM departments");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching departments:", err);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

export default router;
