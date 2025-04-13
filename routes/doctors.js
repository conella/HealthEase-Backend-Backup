const express = require("express");
const router = express.Router();
const sql = require("mssql");

// GET /api/doctors
// Optionally filter by departmentId
router.get("/", async (req, res) => {
  const { departmentId } = req.query;

  try {
    let result;

    if (departmentId) {
      result = await sql.query`
        SELECT 
          u.id, u.firstName, u.lastName, u.email, d.departmentId
        FROM users u
        JOIN doctors d ON u.id = d.userId
        WHERE u.role = 'doctor' AND d.departmentId = ${departmentId}
      `;
    } else {
      result = await sql.query`
        SELECT 
          u.id, u.firstName, u.lastName, u.email, d.departmentId
        FROM users u
        JOIN doctors d ON u.id = d.userId
        WHERE u.role = 'doctor'
      `;
    }

    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching doctors:", err);
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

module.exports = router;
