import express from "express";
import pool from "../db.js";

const router = express.Router();

// Route to check if doctor is on leave on a given date
router.post("/checkleave", async (req, res) => {
  const { doctorId, selectedDate } = req.body;

  if (!doctorId || !selectedDate) {
    return res.status(400).json({ error: "Doctor ID and Selected Date are required" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM doctorleaves WHERE doctorid = $1 AND leavedate = $2",
      [doctorId, selectedDate]
    );

    if (result.rows.length > 0) {
      return res.status(200).json({ isOnLeave: true, message: "Doctor is on leave on the selected date." });
    } else {
      return res.status(200).json({ isOnLeave: false, message: "Doctor is available on the selected date." });
    }
  } catch (err) {
    console.error("Error checking doctor's leave:", err);
    res.status(500).json({ error: "Failed to check doctor's leave status" });
  }
});

export default router;
