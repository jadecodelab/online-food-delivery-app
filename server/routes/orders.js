// =====================================================================
// routes/orders.js - /api/orders
// =====================================================================
const express = require('express');
const dao = require('../DAO');
const {
  ValidationError, optionalText, optionalId, optionalDate, escapeLike,
} = require('../validators');

const router = express.Router();

/**
 * GET /api/orders?customer=&customerId=&statusId=&restaurantId=&from=&to=
 * Search orders. Every filter is optional and they combine with AND.
 *
 * Joins 5 tables:
 *   ORDERS + CUSTOMER (who) + RESTAURANT (where) + ORDER_STATUS (status name)
 *   + ORDER_ITEM (to calculate the total with SUM, since TotalAmount is not stored)
 * GROUP BY collapses the item rows back into one row per order.
 */
router.get('/', async (req, res) => {
  const customer     = optionalText(req.query.customer, 'Customer');
  const customerId   = optionalId(req.query.customerId, 'Customer ID');
  const statusId     = optionalId(req.query.statusId, 'Status');
  const restaurantId = optionalId(req.query.restaurantId, 'Restaurant');
  const from         = optionalDate(req.query.from, 'From date');
  const to           = optionalDate(req.query.to, 'To date');

  if (from && to && from > to) {   // YYYY-MM-DD strings compare correctly as text
    throw new ValidationError('From date cannot be after To date.');
  }

  const where = [];
  const params = [];

  if (customer) {
    // Match full name ("Emily Johnson"), first/last name, or email
    const pattern = `%${escapeLike(customer)}%`;
    where.push("(CONCAT(c.FirstName, ' ', c.LastName) LIKE ? OR c.Email LIKE ?)");
    params.push(pattern, pattern);
  }
  if (customerId !== null)   { where.push('o.CustomerID = ?');   params.push(customerId); }
  if (statusId !== null)     { where.push('o.StatusID = ?');     params.push(statusId); }
  if (restaurantId !== null) { where.push('o.RestaurantID = ?'); params.push(restaurantId); }
  if (from) { where.push('o.OrderDate >= ?'); params.push(from); }
  // "To" is inclusive: include the whole day by using < (to + 1 day)
  if (to)   { where.push('o.OrderDate < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(to); }

  const sql = `
    SELECT o.OrderID,
           o.OrderDate,
           c.CustomerID,
           CONCAT(c.FirstName, ' ', c.LastName)     AS CustomerName,
           r.RestaurantID,
           r.RestaurantName,
           s.StatusID,
           s.StatusName,
           o.DeliveryAddress,
           COUNT(oi.ItemID)                          AS ItemCount,
           SUM(oi.Quantity)                          AS TotalQuantity,
           SUM(oi.Quantity * oi.PriceAtOrderTime)    AS TotalAmount
    FROM ORDERS o
    JOIN CUSTOMER     c  ON c.CustomerID   = o.CustomerID
    JOIN RESTAURANT   r  ON r.RestaurantID = o.RestaurantID
    JOIN ORDER_STATUS s  ON s.StatusID     = o.StatusID
    JOIN ORDER_ITEM   oi ON oi.OrderID     = o.OrderID
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY o.OrderID, o.OrderDate, c.CustomerID, c.FirstName, c.LastName,
             r.RestaurantID, r.RestaurantName, s.StatusID, s.StatusName, o.DeliveryAddress
    ORDER BY o.OrderDate DESC`;

  res.json(await dao.query(sql, params));
});

module.exports = router;
