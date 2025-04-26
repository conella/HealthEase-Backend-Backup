import express from "express";
import pool from "../db.js";

const router = express.Router();

router.post("/addleave", async (req, res) => {
    const { doctorId, leaveDate, reason } = req.body;
  
    if (!doctorId || !leaveDate) {
      return res.status(400).json({ error: "Doctor ID and Leave Date are required" });
    }
  
    try {
      await pool.query(
        `INSERT INTO doctorleaves (doctorid, leavedate, reason) VALUES ($1, $2, $3)`,
        [doctorId, leaveDate, reason || null]
      );
      res.status(201).json({ message: "Leave applied successfully" });
    } catch (err) {
      console.error("Error applying leave:", err);
      res.status(500).json({ error: "Failed to apply leave" });
    }
  });
  
  export default router;