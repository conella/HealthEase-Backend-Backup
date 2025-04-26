import express from "express";
import pool from "../db.js";

const router = express.Router();

// Route to add/update notes for an appointment
router.put("/addnotes/:appointmentId", async (req, res) => {
  const appointmentId = parseInt(req.params.appointmentId);
  const { notes } = req.body;

  if (!appointmentId || !notes) {
    return res.status(400).json({ error: "Appointment ID and Notes are required" });
  }

  try {
    const result = await pool.query(
      `UPDATE appointments SET notes = $1 WHERE id = $2`,
      [notes, appointmentId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.status(200).json({ message: "Notes updated successfully" });
  } catch (err) {
    console.error("Error updating appointment notes:", err);
    res.status(500).json({ error: "Failed to update notes" });
  }
});

export default router;
