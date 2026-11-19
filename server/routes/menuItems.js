// =====================================================================
// routes/menuItems.js - /api/menu-items
// =====================================================================
const express = require('express');
const dao = require('../DAO');
const {
  ValidationError, optionalText, optionalId, optionalMoney, optionalBoolean, escapeLike,
} = require('../validators');

const router = express.Router();

/**
 * GET /api/menu-items?search=&restaurantId=&minPrice=&maxPrice=&available=
 * Search menu items. Every filter is optional and they combine with AND.
 *
 * The WHERE clause is built only from FIXED SQL fragments; user values go
 * into the params array and are sent as ? placeholders (no SQL injection).
 * Filtering happens in MySQL, not in JavaScript.
 */
router.get('/', async (req, res) => {
  // 1) Validate input (throws ValidationError -> 400)
  const search       = optionalText(req.query.search, 'Search keyword');
  const restaurantId = optionalId(req.query.restaurantId, 'Restaurant');
  const minPrice     = optionalMoney(req.query.minPrice, 'Minimum price');
  const maxPrice     = optionalMoney(req.query.maxPrice, 'Maximum price');
  const available    = optionalBoolean(req.query.available, 'Availability');

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw new ValidationError('Minimum price cannot be greater than maximum price.');
  }

  // 2) Build the WHERE clause from fixed fragments + parameters
  const where = [];
  const params = [];

  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    where.push('(m.ItemName LIKE ? OR m.Description LIKE ?)');
    params.push(pattern, pattern);
  }
  if (restaurantId !== null) { where.push('m.RestaurantID = ?');       params.push(restaurantId); }
  if (minPrice !== null)     { where.push('m.Price >= ?');              params.push(minPrice); }
  if (maxPrice !== null)     { where.push('m.Price <= ?');              params.push(maxPrice); }
  if (available !== null)    { where.push('m.AvailabilityStatus = ?');  params.push(available ? 1 : 0); }

  // 3) JOIN with RESTAURANT to show the restaurant name next to each item
  const sql = `
    SELECT m.ItemID, m.ItemName, m.Description, m.Price, m.AvailabilityStatus,
           r.RestaurantID, r.RestaurantName
    FROM MENU_ITEM m
    JOIN RESTAURANT r ON r.RestaurantID = m.RestaurantID
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY r.RestaurantName, m.ItemName`;

  res.json(await dao.query(sql, params));
});

module.exports = router;
