// =====================================================================
// routes/customers.js - /api/customers
// =====================================================================
const express = require("express");
const dao = require("../DAO");
const { optionalText, escapeLike } = require("../validators");

const router = express.Router();

/**
 * GET /api/customers?search=
 * Search customers by full name, email, or phone number.
 *
 * LEFT JOIN with ORDERS so customers who have never ordered
 * still appear, with OrderCount = 0. COUNT(o.OrderID) counts only
 * matching orders because COUNT ignores NULLs.
 */
router.get("/", async (req, res) => {
  const search = optionalText(req.query.search, "Search keyword");

  const where = [];
  const params = [];

  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    const conditions = [
      "CONCAT(c.FirstName, ' ', c.LastName) LIKE ?",
      "c.Email LIKE ?",
      "c.PhoneNumber LIKE ?",
    ];
    params.push(pattern, pattern, pattern);

    // Let "2175550101" match "217-555-0101": compare digits only
    const digits = search.replace(/\D/g, "");
    if (digits.length >= 3) {
      conditions.push("REPLACE(c.PhoneNumber, '-', '') LIKE ?");
      params.push(`%${digits}%`);
    }
    where.push("(" + conditions.join(" OR ") + ")");
  }

  const sql = `
    SELECT c.CustomerID, c.FirstName, c.LastName, c.Email, c.PhoneNumber, c.Address,
           COUNT(o.OrderID) AS OrderCount
    FROM CUSTOMER c
    LEFT JOIN ORDERS o ON o.CustomerID = c.CustomerID
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    GROUP BY c.CustomerID, c.FirstName, c.LastName, c.Email, c.PhoneNumber, c.Address
    ORDER BY c.LastName, c.FirstName`;

  res.json(await dao.query(sql, params));
});

module.exports = router;
