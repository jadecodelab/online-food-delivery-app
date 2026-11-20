// =====================================================================
// routes/reports.js - /api/reports/*   (summary reports: GROUP BY + aggregates)
// =====================================================================
const express = require('express');
const dao = require('../DAO');
const {
  ValidationError, optionalId, optionalDate, optionalBoolean,
} = require('../validators');

const router = express.Router();

/**
 * Shared filters for all reports: date range and whether to count
 * Cancelled orders. Returns SQL condition fragments + parameters.
 * (Cancelled orders are excluded by default: they are not real sales.)
 */
function orderFilters(query) {
  const from = optionalDate(query.from, 'From date');
  const to = optionalDate(query.to, 'To date');
  const includeCancelled = optionalBoolean(query.includeCancelled, 'Include cancelled') === true;
  if (from && to && from > to) throw new ValidationError('From date cannot be after To date.');

  const where = [];
  const params = [];
  if (!includeCancelled) where.push("s.StatusName <> 'Cancelled'");
  if (from) { where.push('o.OrderDate >= ?'); params.push(from); }
  if (to)   { where.push('o.OrderDate < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(to); }
  return { where, params };
}

/**
 * GET /api/reports/restaurant-revenue?from=&to=&includeCancelled=
 * Revenue by restaurant: number of orders, total revenue, average order value.
 *
 * Step 1 (derived table t): one row per order with its total (SUM of items).
 * Step 2: LEFT JOIN restaurants to those order totals and aggregate again,
 *         so restaurants with no orders still appear (0 orders, $0).
 * Two levels are needed because AVG must average ORDER totals, not item lines.
 */
router.get('/restaurant-revenue', async (req, res) => {
  const { where, params } = orderFilters(req.query);

  const sql = `
    SELECT r.RestaurantID,
           r.RestaurantName,
           COUNT(t.OrderID)            AS OrderCount,
           COALESCE(SUM(t.OrderTotal), 0) AS Revenue,
           AVG(t.OrderTotal)           AS AvgOrderValue,
           MAX(t.OrderTotal)           AS LargestOrder
    FROM RESTAURANT r
    LEFT JOIN (
        SELECT o.OrderID, o.RestaurantID,
               SUM(oi.Quantity * oi.PriceAtOrderTime) AS OrderTotal
        FROM ORDERS o
        JOIN ORDER_ITEM   oi ON oi.OrderID  = o.OrderID
        JOIN ORDER_STATUS s  ON s.StatusID  = o.StatusID
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        GROUP BY o.OrderID, o.RestaurantID
    ) t ON t.RestaurantID = r.RestaurantID
    GROUP BY r.RestaurantID, r.RestaurantName
    ORDER BY Revenue DESC, r.RestaurantName`;

  res.json(await dao.query(sql, params));
});

const TOP_LIMITS = [5, 10, 20, 50];

/**
 * GET /api/reports/top-items?restaurantId=&from=&to=&includeCancelled=&limit=&minUnits=
 * Best-selling menu items: units sold, number of orders, revenue.
 * HAVING filters on the aggregated value (units sold), which WHERE cannot do.
 */
router.get('/top-items', async (req, res) => {
  const { where, params } = orderFilters(req.query);
  const restaurantId = optionalId(req.query.restaurantId, 'Restaurant');
  const minUnits = optionalId(req.query.minUnits, 'Minimum units sold');

  // LIMIT value comes from a fixed whitelist (never raw user text)
  const limit = req.query.limit === undefined || req.query.limit === '' ? 10 : Number(req.query.limit);
  if (!TOP_LIMITS.includes(limit)) {
    throw new ValidationError(`Show top must be one of: ${TOP_LIMITS.join(', ')}.`);
  }

  if (restaurantId !== null) { where.push('o.RestaurantID = ?'); params.push(restaurantId); }

  const having = [];
  if (minUnits !== null) { having.push('SUM(oi.Quantity) >= ?'); params.push(minUnits); }

  const sql = `
    SELECT m.ItemID,
           m.ItemName,
           r.RestaurantName,
           SUM(oi.Quantity)                       AS UnitsSold,
           COUNT(DISTINCT oi.OrderID)             AS OrderCount,
           SUM(oi.Quantity * oi.PriceAtOrderTime) AS Revenue
    FROM ORDER_ITEM oi
    JOIN ORDERS       o ON o.OrderID      = oi.OrderID
    JOIN ORDER_STATUS s ON s.StatusID     = o.StatusID
    JOIN MENU_ITEM    m ON m.ItemID       = oi.ItemID
    JOIN RESTAURANT   r ON r.RestaurantID = m.RestaurantID
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY m.ItemID, m.ItemName, r.RestaurantName
    ${having.length ? 'HAVING ' + having.join(' AND ') : ''}
    ORDER BY UnitsSold DESC, Revenue DESC, m.ItemName
    LIMIT ${limit}`;

  res.json(await dao.query(sql, params));
});

/**
 * GET /api/reports/customer-spending?from=&to=&includeCancelled=&onlyWithOrders=
 * Spending per customer: orders, total spent, average order, last order date.
 * LEFT JOIN keeps customers with no (matching) orders, unless onlyWithOrders=true.
 */
router.get('/customer-spending', async (req, res) => {
  const { where, params } = orderFilters(req.query);
  const onlyWithOrders = optionalBoolean(req.query.onlyWithOrders, 'Only customers with orders') === true;

  const sql = `
    SELECT c.CustomerID,
           CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
           c.Email,
           COUNT(t.OrderID)               AS OrderCount,
           COALESCE(SUM(t.OrderTotal), 0) AS TotalSpent,
           AVG(t.OrderTotal)              AS AvgOrderValue,
           MAX(t.OrderDate)               AS LastOrderDate
    FROM CUSTOMER c
    LEFT JOIN (
        SELECT o.OrderID, o.CustomerID, o.OrderDate,
               SUM(oi.Quantity * oi.PriceAtOrderTime) AS OrderTotal
        FROM ORDERS o
        JOIN ORDER_ITEM   oi ON oi.OrderID = o.OrderID
        JOIN ORDER_STATUS s  ON s.StatusID = o.StatusID
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        GROUP BY o.OrderID, o.CustomerID, o.OrderDate
    ) t ON t.CustomerID = c.CustomerID
    GROUP BY c.CustomerID, c.FirstName, c.LastName, c.Email
    ${onlyWithOrders ? 'HAVING COUNT(t.OrderID) > 0' : ''}
    ORDER BY TotalSpent DESC, c.LastName, c.FirstName`;

  res.json(await dao.query(sql, params));
});

module.exports = router;
