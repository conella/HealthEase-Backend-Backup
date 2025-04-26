import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/getleaves/:doctorId", async (req, res) => {
    const doctorId = req.params.doctorId;
  
    try {
      const result = await pool.query(
        `SELECT leavedate FROM doctorleaves WHERE doctorid = $1`,
        [doctorId]
      );
      res.status(200).json(result.rows);
    } catch (err) {
      console.error("Error fetching leaves:", err);
      res.status(500).json({ error: "Failed to fetch leaves" });
    }
  });
  export default router;
  