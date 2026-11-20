// =====================================================================
// routes/orders.js - /api/orders
// =====================================================================
const express = require('express');
const dao = require('../DAO');
const {
  ValidationError, optionalText, optionalId, optionalDate, escapeLike, validateOrder,
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

/**
 * POST /api/orders
 * Body: { customerId, restaurantId, deliveryAddress, items: [{ itemId, quantity }] }
 * Place a new order.
 *
 * Writes to TWO tables (ORDERS + ORDER_ITEM) inside ONE TRANSACTION:
 * either everything is saved (COMMIT) or nothing is (ROLLBACK).
 * An order without items, or items without an order, can never be left behind.
 *
 * Steps:
 *  1) Validate the request format (validators.js -> 400).
 *  2) INSERT the order with status 'Placed'. The FOREIGN KEYS reject a
 *     customer or restaurant that does not exist (MySQL error 1452 -> 400).
 *  3) Read the chosen menu items from MySQL, locking them (FOR SHARE) so
 *     their price cannot change until we commit. Check each item:
 *       - exists
 *       - belongs to the order's restaurant  (business rule: one restaurant per order)
 *       - is currently available
 *  4) INSERT the order items. PriceAtOrderTime is copied from MENU_ITEM.Price
 *     in the database, never taken from the browser (a user cannot set the price).
 *  5) COMMIT, then return the saved order with its total calculated by SQL.
 */
router.post('/', async (req, res) => {
  const order = validateOrder(req.body);

  const conn = await dao.getConnection();
  try {
    await conn.beginTransaction();

    // 2) Insert the order. Status is looked up by name, not a hard-coded ID.
    const [orderResult] = await conn.execute(
      `INSERT INTO ORDERS (CustomerID, RestaurantID, StatusID, DeliveryAddress)
       VALUES (?, ?, (SELECT StatusID FROM ORDER_STATUS WHERE StatusName = 'Placed'), ?)`,
      [order.customerId, order.restaurantId, order.deliveryAddress]
    );
    const orderId = orderResult.insertId;

    // 3) Load and check the chosen items. One "?" per item (fixed SQL fragments only).
    const itemIds = order.items.map((line) => line.itemId);
    const placeholders = itemIds.map(() => '?').join(', ');
    const [menuRows] = await conn.execute(
      `SELECT m.ItemID, m.ItemName, m.RestaurantID, m.Price, m.AvailabilityStatus, r.RestaurantName
       FROM MENU_ITEM m
       JOIN RESTAURANT r ON r.RestaurantID = m.RestaurantID
       WHERE m.ItemID IN (${placeholders})
       FOR SHARE`,
      itemIds
    );
    const byId = new Map(menuRows.map((row) => [row.ItemID, row]));

    const problems = [];
    for (const line of order.items) {
      const item = byId.get(line.itemId);
      if (!item) {
        problems.push(`Menu item #${line.itemId} does not exist.`);
      } else if (item.RestaurantID !== order.restaurantId) {
        problems.push(`"${item.ItemName}" is from ${item.RestaurantName}. ` +
          'An order can only contain items from one restaurant.');
      } else if (!item.AvailabilityStatus) {
        problems.push(`"${item.ItemName}" is currently unavailable.`);
      }
    }
    if (problems.length > 0) {
      throw new ValidationError(problems.join(' '), { items: problems.join(' ') });
    }

    // 4) Insert all order items in one statement, with prices from the database
    const valueRows = order.items.map(() => '(?, ?, ?, ?)').join(', ');
    const values = order.items.flatMap((line) =>
      [orderId, line.itemId, line.quantity, byId.get(line.itemId).Price]);
    await conn.execute(
      `INSERT INTO ORDER_ITEM (OrderID, ItemID, Quantity, PriceAtOrderTime) VALUES ${valueRows}`,
      values
    );

    await conn.commit();

    // 5) Read back the saved order and its SQL-calculated total
    const [[saved]] = await conn.execute(
      `SELECT o.OrderID, o.OrderDate, s.StatusName, r.RestaurantName,
              CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
              SUM(oi.Quantity)                       AS TotalQuantity,
              SUM(oi.Quantity * oi.PriceAtOrderTime) AS TotalAmount
       FROM ORDERS o
       JOIN CUSTOMER     c  ON c.CustomerID   = o.CustomerID
       JOIN RESTAURANT   r  ON r.RestaurantID = o.RestaurantID
       JOIN ORDER_STATUS s  ON s.StatusID     = o.StatusID
       JOIN ORDER_ITEM   oi ON oi.OrderID     = o.OrderID
       WHERE o.OrderID = ?
       GROUP BY o.OrderID, o.OrderDate, s.StatusName, r.RestaurantName, c.FirstName, c.LastName`,
      [orderId]
    );

    res.status(201).json({
      message: `Order #${saved.OrderID} was placed for ${saved.CustomerName} at ${saved.RestaurantName}: ` +
        `${saved.TotalQuantity} item(s), total $${Number(saved.TotalAmount).toFixed(2)}.`,
      order: saved,
    });
  } catch (err) {
    await conn.rollback();   // undo the ORDERS insert if anything failed
    throw err;               // index.js turns it into a clear message
  } finally {
    conn.release();          // return the connection to the pool
  }
});

module.exports = router;
