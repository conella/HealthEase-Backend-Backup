const express = require('express');
const router = express.Router();
const sql = require('mssql');

// GET all departments
router.get('/', async (req, res) => {
  try {
    const result = await sql.query`SELECT * FROM departments`;
    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching departments:", err);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

module.exports = router;