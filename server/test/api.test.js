// =====================================================================
// test/api.test.js - Automated API tests (Node's built-in test runner)
//
//   1) Start the server:   npm start      (in one terminal)
//   2) Run the tests:      npm test       (in another terminal, in server/)
//
// These tests NEVER change the data: they only read, or send requests
// that must be REJECTED (validation, duplicate key, foreign key, rules)
// or that change nothing. Note: a rejected order insert can still use up
// an AUTO_INCREMENT number (normal MySQL behaviour).
// =====================================================================
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function call(method, path, body, rawBody) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* HTML page */ }
  return { status: res.status, data };
}
const get = (path) => call('GET', path);

// Data looked up once, so tests do not depend on exact IDs
let customers, restaurants, items, statuses, orders;

before(async () => {
  const health = await get('/api/health').catch(() => null);
  if (!health || health.status !== 200) {
    throw new Error(`Server not reachable at ${BASE}. Start it with "npm start" first.`);
  }
  customers = (await get('/api/customers')).data;
  restaurants = (await get('/api/restaurants')).data;
  items = (await get('/api/menu-items')).data;
  statuses = (await get('/api/order-statuses')).data;
  orders = (await get('/api/orders')).data;
});

const statusId = (name) => statuses.find((s) => s.StatusName === name).StatusID;
const validCustomer = (overrides = {}) => ({
  firstName: 'Test', lastName: 'Person', phoneNumber: '217-555-0000',
  email: 'nobody.test@example.com', address: '1 Test St, Springfield, IL 62701', ...overrides,
});

// ---------------------------------------------------------------------
describe('View and search', () => {
  test('health check reports all 6 tables', async () => {
    const { status, data } = await get('/api/health');
    assert.equal(status, 200);
    assert.equal(data.tables.length, 6);
  });

  test('menu keyword search only returns matching items', async () => {
    const { status, data } = await get('/api/menu-items?search=chicken');
    assert.equal(status, 200);
    assert.ok(data.length > 0);
    for (const item of data) {
      assert.match(`${item.ItemName} ${item.Description}`, /chicken/i);
    }
  });

  test('menu price and availability filters are applied by SQL', async () => {
    const { data } = await get('/api/menu-items?maxPrice=10&available=true');
    assert.ok(data.every((i) => i.Price <= 10 && i.AvailabilityStatus === 1));
  });

  test('"%" is searched literally, not as a wildcard', async () => {
    const { data } = await get('/api/menu-items?search=%25');
    assert.ok(data.every((i) => `${i.ItemName}${i.Description}`.includes('%')));
  });

  test('order search by status returns only that status', async () => {
    const { data } = await get(`/api/orders?statusId=${statusId('Delivered')}`);
    assert.ok(data.length > 0);
    assert.ok(data.every((o) => o.StatusName === 'Delivered'));
  });

  test('order date range is inclusive of the To date', async () => {
    const { data } = await get('/api/orders?from=2026-09-01&to=2026-09-15');
    assert.ok(data.every((o) => o.OrderDate >= '2026-09-01' && o.OrderDate < '2026-09-16'));
  });

  test('customer search lists customers with 0 orders (LEFT JOIN)', async () => {
    const { data } = await get('/api/customers');
    assert.ok(data.some((c) => c.OrderCount === 0));
  });

  test('invalid search values are rejected with 400', async () => {
    for (const path of [
      '/api/menu-items?minPrice=abc',
      '/api/menu-items?minPrice=20&maxPrice=5',
      '/api/menu-items?restaurantId=-1',
      '/api/orders?from=2026-02-30',
      '/api/orders?from=2026-11-10&to=2026-11-01',
      '/api/orders?statusId=abc',
    ]) {
      const { status, data } = await get(path);
      assert.equal(status, 400, path);
      assert.ok(data.error, path);
    }
  });
});

// ---------------------------------------------------------------------
describe('Insert - failure cases (nothing is saved)', () => {
  test('add customer with missing input -> 400 with a message per field', async () => {
    const { status, data } = await call('POST', '/api/customers', {});
    assert.equal(status, 400);
    assert.deepEqual(Object.keys(data.fields).sort(),
      ['address', 'email', 'firstName', 'lastName', 'phoneNumber']);
  });

  test('add customer with invalid values -> 400', async () => {
    const { status, data } = await call('POST', '/api/customers',
      validCustomer({ firstName: 'J0hn', phoneNumber: 'abc', email: 'not-an-email' }));
    assert.equal(status, 400);
    assert.ok(data.fields.firstName && data.fields.phoneNumber && data.fields.email);
  });

  test('add customer with duplicate email (any case) -> 409 from UNIQUE constraint', async () => {
    const existing = customers[0].Email.toUpperCase();
    const { status, data } = await call('POST', '/api/customers', validCustomer({ email: existing }));
    assert.equal(status, 409);
    assert.match(data.dbCode, /ER_DUP_ENTRY/);
  });

  test('place order for a customer that does not exist -> 400 from FOREIGN KEY', async () => {
    const item = items.find((i) => i.AvailabilityStatus);
    const { status, data } = await call('POST', '/api/orders', {
      customerId: 2147483647, restaurantId: item.RestaurantID,
      deliveryAddress: '1 Test St', items: [{ itemId: item.ItemID, quantity: 1 }],
    });
    assert.equal(status, 400);
    assert.match(data.dbCode, /ER_NO_REFERENCED_ROW/);
  });

  test('place order mixing two restaurants -> 400 (one restaurant per order)', async () => {
    const a = items.find((i) => i.AvailabilityStatus);
    const b = items.find((i) => i.AvailabilityStatus && i.RestaurantID !== a.RestaurantID);
    const { status, data } = await call('POST', '/api/orders', {
      customerId: customers[0].CustomerID, restaurantId: a.RestaurantID, deliveryAddress: '1 Test St',
      items: [{ itemId: a.ItemID, quantity: 1 }, { itemId: b.ItemID, quantity: 1 }],
    });
    assert.equal(status, 400);
    assert.match(data.error, /one restaurant/);
  });

  test('place order with an unavailable item -> 400', async (t) => {
    const off = items.find((i) => !i.AvailabilityStatus);
    if (!off) return t.skip('no unavailable item in the data');
    const { status, data } = await call('POST', '/api/orders', {
      customerId: customers[0].CustomerID, restaurantId: off.RestaurantID, deliveryAddress: '1 Test St',
      items: [{ itemId: off.ItemID, quantity: 1 }],
    });
    assert.equal(status, 400);
    assert.match(data.error, /unavailable/);
  });

  test('place order with bad quantities -> 400', async () => {
    for (const quantity of [0, 100, 1.5, true, '', '1e1']) {
      const { status } = await call('POST', '/api/orders', {
        customerId: 1, restaurantId: 1, deliveryAddress: '1 Test St', items: [{ itemId: 1, quantity }],
      });
      assert.equal(status, 400, `quantity ${JSON.stringify(quantity)}`);
    }
  });

  test('place order with no items -> 400', async () => {
    const { status } = await call('POST', '/api/orders',
      { customerId: 1, restaurantId: 1, deliveryAddress: '1 Test St', items: [] });
    assert.equal(status, 400);
  });
});

// ---------------------------------------------------------------------
describe('Update - failure and no-change cases (nothing is changed)', () => {
  test('edit customer that does not exist -> 404', async () => {
    const { status } = await call('PUT', '/api/customers/999999999', validCustomer());
    assert.equal(status, 404);
  });

  test('edit customer to another customer\'s email -> 409', async () => {
    const [a, b] = customers;
    const { status } = await call('PUT', `/api/customers/${a.CustomerID}`, {
      firstName: a.FirstName, lastName: a.LastName, phoneNumber: a.PhoneNumber,
      email: b.Email, address: a.Address,
    });
    assert.equal(status, 409);
  });

  test('saving a customer with the same values -> 200, changed: false', async () => {
    const a = customers[0];
    const { status, data } = await call('PUT', `/api/customers/${a.CustomerID}`, {
      firstName: a.FirstName, lastName: a.LastName, phoneNumber: a.PhoneNumber,
      email: a.Email, address: a.Address,
    });
    assert.equal(status, 200);
    assert.equal(data.changed, false);
  });

  test('changing a Delivered order\'s status -> 400 (final status)', async () => {
    const delivered = orders.find((o) => o.StatusName === 'Delivered');
    const { status, data } = await call('PATCH', `/api/orders/${delivered.OrderID}/status`,
      { statusId: statusId('Placed') });
    assert.equal(status, 400);
    assert.match(data.error, /final/);
  });

  test('order status that does not exist -> 400', async () => {
    const open = orders[0];
    const { status } = await call('PATCH', `/api/orders/${open.OrderID}/status`, { statusId: 99 });
    assert.equal(status, 400);
  });

  test('menu item renamed to a name its restaurant already uses -> 409', async () => {
    const [a, b] = items.filter((i) => i.RestaurantID === items[0].RestaurantID);
    const { status, data } = await call('PUT', `/api/menu-items/${a.ItemID}`, {
      itemName: b.ItemName, description: a.Description, price: a.Price,
      availabilityStatus: Boolean(a.AvailabilityStatus),
    });
    assert.equal(status, 409);
    assert.match(data.dbCode, /ER_DUP_ENTRY/);
  });

  test('menu item with negative price -> 400', async () => {
    const a = items[0];
    const { status } = await call('PUT', `/api/menu-items/${a.ItemID}`,
      { itemName: a.ItemName, price: '-1', availabilityStatus: true });
    assert.equal(status, 400);
  });
});

// ---------------------------------------------------------------------
describe('Reports', () => {
  test('revenue report lists every restaurant, including ones with no orders', async () => {
    const { status, data } = await get('/api/reports/restaurant-revenue');
    assert.equal(status, 200);
    assert.equal(data.length, restaurants.length);
    assert.ok(data.every((r) => r.Revenue >= 0));
  });

  test('top items respects minimum units (HAVING)', async () => {
    const { data } = await get('/api/reports/top-items?minUnits=3&limit=50');
    assert.ok(data.every((r) => r.UnitsSold >= 3));
  });

  test('customer spending can hide customers without orders', async () => {
    const { data } = await get('/api/reports/customer-spending?onlyWithOrders=true');
    assert.ok(data.every((r) => r.OrderCount > 0));
  });

  test('invalid report options -> 400', async () => {
    assert.equal((await get('/api/reports/top-items?limit=7')).status, 400);
    assert.equal((await get('/api/reports/restaurant-revenue?from=2026-11-10&to=2026-11-01')).status, 400);
  });
});

// ---------------------------------------------------------------------
describe('Robustness', () => {
  test('unknown API route -> 404 JSON', async () => {
    const { status, data } = await get('/api/does-not-exist');
    assert.equal(status, 404);
    assert.ok(data.error);
  });

  test('unknown page -> friendly 404 page', async () => {
    const { status, data } = await get('/no-such-page.html');
    assert.equal(status, 404);
    assert.match(data, /Page not found/);
  });

  test('malformed JSON -> 400', async () => {
    const { status } = await call('POST', '/api/customers', undefined, '{bad');
    assert.equal(status, 400);
  });

  test('request body too large -> 413', async () => {
    const { status } = await call('POST', '/api/customers', { address: 'x'.repeat(200000) });
    assert.equal(status, 413);
  });
});
