// =====================================================================
// routes/menuItems.js - /api/menu-items
// =====================================================================
const express = require('express');
const dao = require('../DAO');
const {
  ValidationError, NotFoundError, idParam, validateMenuItem,
  optionalText, optionalId, optionalMoney, optionalBoolean, escapeLike,
} = require('../validators');

const router = express.Router();

/** Read one menu item (with its restaurant name) by ID. */
async function findMenuItem(itemId) {
  const [row] = await dao.query(
    `SELECT m.ItemID, m.ItemName, m.Description, m.Price, m.AvailabilityStatus,
            r.RestaurantID, r.RestaurantName
     FROM MENU_ITEM m
     JOIN RESTAURANT r ON r.RestaurantID = m.RestaurantID
     WHERE m.ItemID = ?`,
    [itemId]
  );
  return row;
}

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

/**
 * GET /api/menu-items/:id
 * One menu item, read fresh from MySQL (fills the Edit form).
 */
router.get('/:id', async (req, res) => {
  const itemId = idParam(req.params.id, 'Item ID');
  const item = await findMenuItem(itemId);
  if (!item) throw new NotFoundError(`Menu item #${itemId} was not found.`);
  res.json(item);
});

/**
 * PUT /api/menu-items/:id
 * Body: { itemName, description, price, availabilityStatus }
 * Update ONE menu item (WHERE ItemID = ?).
 *
 * - RestaurantID is NOT editable: moving an item to another restaurant would
 *   make past orders break the one-restaurant-per-order rule.
 * - Renaming to a name the same restaurant already uses is rejected by
 *   UNIQUE (RestaurantID, ItemName) -> MySQL 1062 -> 409.
 * - Changing Price does NOT change past orders: they keep PriceAtOrderTime.
 */
router.put('/:id', async (req, res) => {
  const itemId = idParam(req.params.id, 'Item ID');
  const m = validateMenuItem(req.body);

  const before = await findMenuItem(itemId);
  if (!before) throw new NotFoundError(`Menu item #${itemId} was not found.`);

  const unchanged =
    before.ItemName === m.itemName &&
    (before.Description || null) === m.description &&
    Number(before.Price) === m.price &&
    Boolean(before.AvailabilityStatus) === m.availabilityStatus;

  if (!unchanged) {
    await dao.query(
      `UPDATE MENU_ITEM
       SET ItemName = ?, Description = ?, Price = ?, AvailabilityStatus = ?
       WHERE ItemID = ?`,
      [m.itemName, m.description, m.price, m.availabilityStatus ? 1 : 0, itemId]
    );
  }

  const saved = await findMenuItem(itemId);

  let message = unchanged
    ? `No changes were made to ${saved.ItemName}.`
    : `${saved.ItemName} (${saved.RestaurantName}) was updated.`;
  if (!unchanged && Number(before.Price) !== m.price) {
    message += ` Price changed from $${Number(before.Price).toFixed(2)} to $${m.price.toFixed(2)};` +
      ' existing orders keep the price paid at order time.';
  }

  res.json({ message, item: saved, changed: !unchanged });
});

module.exports = router;
