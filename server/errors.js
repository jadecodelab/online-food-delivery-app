// =====================================================================
// errors.js - Turn MySQL constraint errors into clear user messages.
//
// The database is the final guard: even if a check is missed elsewhere,
// MySQL rejects bad data (UNIQUE, FOREIGN KEY, CHECK, NOT NULL). Here we
// translate those errors into messages a user can act on, instead of a
// crash or a generic "500 Internal Server Error".
// =====================================================================

// UNIQUE constraint name -> { field, message }
const DUPLICATE_MESSAGES = {
  uq_customer_email: { field: 'email', message: 'A customer with this email address already exists.' },
  uq_menu_item_name: { field: 'itemName', message: 'This restaurant already has a menu item with that name.' },
  uq_status_name:    { field: 'statusName', message: 'This order status already exists.' },
  PRIMARY:           { field: null, message: 'This record already exists.' },
};

// FOREIGN KEY constraint name -> { field, message }
const FOREIGN_KEY_MESSAGES = {
  fk_menu_restaurant:   { field: 'restaurantId', message: 'The selected restaurant does not exist.' },
  fk_orders_customer:   { field: 'customerId', message: 'The selected customer does not exist.' },
  fk_orders_restaurant: { field: 'restaurantId', message: 'The selected restaurant does not exist.' },
  fk_orders_status:     { field: 'statusId', message: 'The selected order status does not exist.' },
  fk_orderitem_order:   { field: 'orderId', message: 'The order does not exist.' },
  fk_orderitem_item:    { field: 'items', message: 'One of the selected menu items does not exist.' },
};

// CHECK constraint name -> { field, message }
const CHECK_MESSAGES = {
  chk_customer_email:  { field: 'email', message: 'Email address is not valid.' },
  chk_customer_first:  { field: 'firstName', message: 'First name cannot be blank.' },
  chk_customer_last:   { field: 'lastName', message: 'Last name cannot be blank.' },
  chk_restaurant_name: { field: 'restaurantName', message: 'Restaurant name cannot be blank.' },
  chk_menu_price:      { field: 'price', message: 'Price cannot be negative.' },
  chk_menu_name:       { field: 'itemName', message: 'Item name cannot be blank.' },
  chk_orderitem_qty:   { field: 'items', message: 'Quantity must be at least 1.' },
  chk_orderitem_price: { field: 'items', message: 'Price cannot be negative.' },
};

/** Find which named constraint appears in MySQL's error message. */
function findConstraint(sqlMessage, table) {
  return Object.keys(table).find((name) => sqlMessage.includes(`'${name}'`) || sqlMessage.includes(`.${name}'`)
    || sqlMessage.includes(`\`${name}\``));
}

/**
 * Convert a MySQL error into { status, message, fields, dbCode }.
 * Returns null if it is not a known data/constraint error (-> 500).
 */
function mapDbError(err) {
  if (!err || !err.code || typeof err.sqlMessage !== 'string') return null;
  const msg = err.sqlMessage;
  const result = (status, info, fallback) => ({
    status,
    message: info ? info.message : fallback,
    fields: info && info.field ? { [info.field]: info.message } : null,
    dbCode: `${err.code} (${err.errno})`,
  });

  switch (err.code) {
    case 'ER_DUP_ENTRY': {                         // 1062: UNIQUE / PRIMARY KEY
      const name = findConstraint(msg, DUPLICATE_MESSAGES);
      return result(409, DUPLICATE_MESSAGES[name], 'This value already exists and must be unique.');
    }
    case 'ER_NO_REFERENCED_ROW_2':                 // 1452: FOREIGN KEY target missing
    case 'ER_NO_REFERENCED_ROW': {
      const name = findConstraint(msg, FOREIGN_KEY_MESSAGES);
      return result(400, FOREIGN_KEY_MESSAGES[name], 'A selected related record does not exist.');
    }
    case 'ER_ROW_IS_REFERENCED_2':                 // 1451: still used by other rows
    case 'ER_ROW_IS_REFERENCED':
      return result(409, null, 'This record is used by other records and cannot be changed or removed.');
    case 'ER_CHECK_CONSTRAINT_VIOLATED': {         // 3819: CHECK
      const name = findConstraint(msg, CHECK_MESSAGES);
      return result(400, CHECK_MESSAGES[name], 'A value is not allowed by the database rules.');
    }
    case 'ER_BAD_NULL_ERROR':                      // 1048: NULL into NOT NULL
    case 'ER_NO_DEFAULT_FOR_FIELD':                // 1364: required column missing
      return result(400, null, 'A required value is missing.');
    case 'ER_DATA_TOO_LONG':                       // 1406
      return result(400, null, 'A value is too long for the database.');
    case 'ER_WARN_DATA_OUT_OF_RANGE':              // 1264
    case 'WARN_DATA_TRUNCATED':                    // 1265
    case 'ER_TRUNCATED_WRONG_VALUE':               // 1292
    case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':     // 1366
      return result(400, null, 'A value has the wrong format or is out of range.');
    default:
      return null;
  }
}

module.exports = { mapDbError };
