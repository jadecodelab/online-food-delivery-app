// =====================================================================
// orders.js - Order Search page
// Filters are sent to the server; MySQL does the JOINs, filtering and totals.
// =====================================================================

const form      = document.getElementById('search-form');
const searchBtn = document.getElementById('search-btn');
const resetBtn  = document.getElementById('reset-btn');
const message   = document.getElementById('message');
const summary   = document.getElementById('summary');
const table     = document.getElementById('results');
const tbody     = table.querySelector('tbody');
const fromInput = document.getElementById('from');
const toInput   = document.getElementById('to');
const customerIdInput = document.getElementById('customerId');
const customerNote    = document.getElementById('customer-note');

/**
 * If we came from the Customers page (orders.html?customerId=5),
 * keep that customer filter and show a note with a way to remove it.
 */
function applyCustomerFromUrl() {
  const id = new URLSearchParams(window.location.search).get('customerId');
  if (id && /^\d+$/.test(id)) customerIdInput.value = id;
}

function updateCustomerNote(orders) {
  if (!customerIdInput.value) {
    customerNote.hidden = true;
    return;
  }
  const name = orders.length ? orders[0].CustomerName : `customer #${customerIdInput.value}`;
  customerNote.innerHTML = `Showing only orders for <strong>${escapeHtml(name)}</strong>. ` +
    '<button type="button" class="btn btn-secondary" id="clear-customer">Show all orders</button>';
  customerNote.hidden = false;
  document.getElementById('clear-customer').addEventListener('click', clearCustomerFilter);
}

function clearCustomerFilter() {
  customerIdInput.value = '';
  history.replaceState(null, '', '/orders.html');   // remove ?customerId= from the address bar
  runSearch();
}

/** Add <option>s to a <select> from a list of rows. */
function fillSelect(select, rows, valueKey, textKey) {
  rows.forEach((row) => {
    const option = document.createElement('option');
    option.value = row[valueKey];
    option.textContent = row[textKey];
    select.appendChild(option);
  });
}

/** Load both dropdowns from the database (in parallel). */
async function loadDropdowns() {
  const [statuses, restaurants] = await Promise.all([
    api('/api/order-statuses'),
    api('/api/restaurants'),
  ]);
  fillSelect(document.getElementById('statusId'), statuses, 'StatusID', 'StatusName');
  fillSelect(document.getElementById('restaurantId'), restaurants, 'RestaurantID', 'RestaurantName');
}

/** Browser-side validation (the server checks again). Returns '' if valid. */
function validateForm() {
  [fromInput, toInput].forEach((el) => el.classList.remove('invalid'));

  for (const el of [fromInput, toInput]) {
    if (el.validity.badInput) {
      el.classList.add('invalid');
      return `${el.labels[0].textContent} is not a valid date.`;
    }
  }
  if (fromInput.value && toInput.value && fromInput.value > toInput.value) {
    fromInput.classList.add('invalid');
    toInput.classList.add('invalid');
    return 'From date cannot be after To date.';
  }
  return '';
}

/** Build the query string from non-empty form fields only. */
function buildQuery() {
  const params = new URLSearchParams();
  new FormData(form).forEach((value, key) => {
    if (String(value).trim() !== '') params.append(key, String(value).trim());
  });
  return params.toString();
}

/** Draw the results table (all text escaped). highlightId marks a new order. */
function renderResults(orders, highlightId = null) {
  tbody.innerHTML = orders.map((o) => `
    <tr${o.OrderID === highlightId ? ' class="row-new"' : ''}>
      <td data-label="Order #"><strong>#${o.OrderID}</strong></td>
      <td data-label="Date">${formatDateTime(o.OrderDate)}</td>
      <td data-label="Customer">${escapeHtml(o.CustomerName)}</td>
      <td data-label="Restaurant">${escapeHtml(o.RestaurantName)}</td>
      <td data-label="Items" class="num">${o.TotalQuantity}
        <span class="text-muted">(${o.ItemCount} ${o.ItemCount === 1 ? 'line' : 'lines'})</span></td>
      <td data-label="Total" class="num"><strong>${formatMoney(o.TotalAmount)}</strong></td>
      <td data-label="Status"><span class="badge ${statusClass(o.StatusName)}">${escapeHtml(o.StatusName)}</span></td>
      <td data-label="Delivery address">${escapeHtml(o.DeliveryAddress)}</td>
      <td data-label="Actions">
        <button type="button" class="btn btn-secondary btn-small" data-status-id="${o.OrderID}"
                aria-label="Update status of order ${o.OrderID}">Update status</button>
      </td>
    </tr>`).join('');

  table.hidden = orders.length === 0;

  if (orders.length === 0) {
    summary.textContent = 'Found 0 orders.';
    showMessage(message, 'info', 'No orders match your filters. Try removing some filters.');
    return;
  }
  summary.textContent = `Found ${orders.length} ${orders.length === 1 ? 'order' : 'orders'}.`;
}

/** Validate, ask the server, and show the results. */
async function runSearch(highlightId = null) {
  const error = validateForm();
  if (error) {
    showMessage(message, 'error', error);
    return;
  }

  showMessage(message, '', '');
  searchBtn.disabled = true;
  summary.textContent = 'Searching…';
  try {
    const query = buildQuery();
    const orders = await api('/api/orders' + (query ? '?' + query : ''));
    renderResults(orders, highlightId);
    updateCustomerNote(orders);
  } catch (err) {
    table.hidden = true;
    summary.textContent = '';
    showMessage(message, 'error', err.message);
  } finally {
    searchBtn.disabled = false;
  }
}

// =====================================================================
// Place order form
// =====================================================================
const newOrderBtn      = document.getElementById('new-order-btn');
const orderForm        = document.getElementById('order-form');
const orderMessage     = document.getElementById('order-form-message');
const orderCustomer    = document.getElementById('order-customer');
const orderRestaurant  = document.getElementById('order-restaurant');
const orderAddress     = document.getElementById('order-address');
const picker           = document.getElementById('items');
const estimate         = document.getElementById('order-estimate');
const placeBtn         = document.getElementById('place-btn');
const orderCancelBtn   = document.getElementById('order-cancel-btn');
const MAX_QTY = 99;

let customersById = new Map();   // for filling in the customer's address
let autoAddress = '';            // address we filled in automatically
let currentRestaurant = '';      // to undo a restaurant change the user cancels

/** Load customers and restaurants for the order form dropdowns (once). */
async function loadOrderFormOptions() {
  if (customersById.size > 0) return;
  const [customers, restaurants] = await Promise.all([api('/api/customers'), api('/api/restaurants')]);
  customersById = new Map(customers.map((c) => [String(c.CustomerID), c]));
  customers.forEach((c) => {
    const option = document.createElement('option');
    option.value = c.CustomerID;
    option.textContent = `${c.FirstName} ${c.LastName} (${c.Email})`;
    orderCustomer.appendChild(option);
  });
  fillSelect(orderRestaurant, restaurants, 'RestaurantID', 'RestaurantName');
}

/** Show the available menu items of the chosen restaurant with quantity boxes. */
async function loadPicker(restaurantId) {
  estimate.textContent = '';
  if (!restaurantId) {
    picker.innerHTML = '<p class="picker-empty">Choose a restaurant to see its available menu items.</p>';
    return;
  }
  picker.innerHTML = '<p class="picker-empty">Loading menu…</p>';
  const items = await api(`/api/menu-items?restaurantId=${encodeURIComponent(restaurantId)}&available=true`);
  if (items.length === 0) {
    picker.innerHTML = '<p class="picker-empty">This restaurant has no available items right now.</p>';
    return;
  }
  picker.innerHTML = items.map((item) => `
    <div class="picker-row">
      <div>
        <div class="item-name">${escapeHtml(item.ItemName)}</div>
        <div class="item-desc">${escapeHtml(item.Description)}</div>
      </div>
      <div class="item-price">${formatMoney(item.Price)}</div>
      <input type="number" min="0" max="${MAX_QTY}" step="1" value="0" inputmode="numeric"
             aria-label="Quantity of ${escapeHtml(item.ItemName)}"
             data-item-id="${item.ItemID}" data-price="${item.Price}">
    </div>`).join('');
}

function quantityInputs() {
  return [...picker.querySelectorAll('input[data-item-id]')];
}

/** Estimated total while choosing (display only; the saved total comes from SQL). */
function updateEstimate() {
  let count = 0;
  let total = 0;
  quantityInputs().forEach((input) => {
    const qty = Number(input.value);
    const row = input.closest('.picker-row');
    const valid = Number.isInteger(qty) && qty > 0 && qty <= MAX_QTY;
    row.classList.toggle('selected', valid);
    if (valid) { count += qty; total += qty * Number(input.dataset.price); }
  });
  estimate.innerHTML = count > 0
    ? `${count} item(s) · estimated total ${formatMoney(total)} <span class="text-muted">(final total is calculated by the database)</span>`
    : '';
}

function hasSelectedItems() {
  return quantityInputs().some((input) => Number(input.value) > 0);
}

async function openOrderForm() {
  orderForm.reset();
  showFieldErrors(orderForm, {});
  showMessage(orderMessage, '', '');
  autoAddress = '';
  currentRestaurant = '';
  orderForm.hidden = false;
  newOrderBtn.hidden = true;
  try {
    await loadOrderFormOptions();
    await loadPicker('');
    orderCustomer.focus();
  } catch (err) {
    showMessage(orderMessage, 'error', 'Could not load the form: ' + err.message);
  }
}

function closeOrderForm() {
  orderForm.reset();
  showFieldErrors(orderForm, {});
  showMessage(orderMessage, '', '');
  picker.innerHTML = '';
  estimate.textContent = '';
  orderForm.hidden = true;
  newOrderBtn.hidden = false;
}

function orderFormHasInput() {
  return orderCustomer.value || orderRestaurant.value || orderAddress.value.trim() || hasSelectedItems();
}

/** Browser-side validation (the server checks again). Returns an errors object. */
function validateOrderForm(data) {
  const errors = {};
  if (!data.customerId) errors.customerId = 'Customer is required.';
  if (!data.restaurantId) errors.restaurantId = 'Restaurant is required.';
  if (!data.deliveryAddress) errors.deliveryAddress = 'Delivery address is required.';
  else if (data.deliveryAddress.length > 200) errors.deliveryAddress = 'Delivery address must be at most 200 characters.';

  const badQty = quantityInputs().find((input) => {
    const qty = Number(input.value);
    return input.validity.badInput || !Number.isInteger(qty) || qty < 0 || qty > MAX_QTY;
  });
  if (badQty) errors.items = `Each quantity must be a whole number from 0 to ${MAX_QTY}.`;
  else if (data.restaurantId && data.items.length === 0) errors.items = 'Set a quantity of 1 or more for at least one item.';
  return errors;
}

function readOrderForm() {
  return {
    customerId: orderCustomer.value,
    restaurantId: orderRestaurant.value,
    deliveryAddress: orderAddress.value.trim().replace(/\s+/g, ' '),
    items: quantityInputs()
      .filter((input) => Number(input.value) > 0)
      .map((input) => ({ itemId: Number(input.dataset.itemId), quantity: Number(input.value) })),
  };
}

async function placeOrder(event) {
  event.preventDefault();
  const data = readOrderForm();
  const errors = validateOrderForm(data);
  picker.classList.toggle('invalid', Boolean(errors.items));
  if (Object.keys(errors).length > 0) {
    showFieldErrors(orderForm, errors);
    showMessage(orderMessage, 'error', 'Please correct the highlighted fields.');
    return;
  }

  showFieldErrors(orderForm, {});
  showMessage(orderMessage, '', '');
  placeBtn.disabled = true;
  try {
    const result = await api('/api/orders', { method: 'POST', body: JSON.stringify(data) });
    closeOrderForm();
    // Show all orders again, reloaded from MySQL, with the new one highlighted
    form.reset();
    customerIdInput.value = '';
    history.replaceState(null, '', '/orders.html');
    await runSearch(result.order.OrderID);
    showMessage(message, 'success', '✅ ' + result.message);
  } catch (err) {
    // Server validation, business rule (wrong restaurant / unavailable), or FK error
    showFieldErrors(orderForm, err.fields || {});
    picker.classList.toggle('invalid', Boolean(err.fields && err.fields.items));
    showMessage(orderMessage, 'error', err.message);
  } finally {
    placeBtn.disabled = false;
  }
}

function cancelOrderForm() {
  if (orderFormHasInput() && !confirm('Discard this order? Nothing will be saved.')) return;
  closeOrderForm();
  showMessage(message, 'info', 'Cancelled. No order was placed.');
}

// Fill the delivery address from the chosen customer (unless the user typed their own)
orderCustomer.addEventListener('change', () => {
  const customer = customersById.get(orderCustomer.value);
  const typed = orderAddress.value.trim();
  if (customer && (typed === '' || typed === autoAddress)) {
    orderAddress.value = customer.Address;
    autoAddress = customer.Address;
  }
});

// Changing restaurant clears chosen items (one restaurant per order)
orderRestaurant.addEventListener('change', async () => {
  if (hasSelectedItems() &&
      !confirm('Changing the restaurant will clear the items you selected. Continue?')) {
    orderRestaurant.value = currentRestaurant;
    return;
  }
  currentRestaurant = orderRestaurant.value;
  try {
    await loadPicker(orderRestaurant.value);
  } catch (err) {
    showMessage(orderMessage, 'error', 'Could not load menu: ' + err.message);
  }
});

picker.addEventListener('input', updateEstimate);
newOrderBtn.addEventListener('click', openOrderForm);
orderForm.addEventListener('submit', placeOrder);
orderCancelBtn.addEventListener('click', cancelOrderForm);

// =====================================================================
// Update order status
// =====================================================================
const statusForm        = document.getElementById('status-form');
const statusTitle       = document.getElementById('status-title');
const statusSummary     = document.getElementById('status-summary');
const statusMessage     = document.getElementById('status-form-message');
const statusItemsBody   = document.querySelector('#status-items tbody');
const statusField       = document.getElementById('status-field');
const newStatusSelect   = document.getElementById('new-status');
const statusSaveBtn     = document.getElementById('status-save-btn');
const statusCancelBtn   = document.getElementById('status-cancel-btn');
let statusOrderId = null;

/** Load one order fresh from MySQL and show it with its allowed next statuses. */
async function openStatusForm(orderId) {
  try {
    const order = await api(`/api/orders/${orderId}`);
    statusOrderId = order.OrderID;

    statusTitle.textContent = `Update status — order #${order.OrderID}`;
    statusSummary.innerHTML =
      `${escapeHtml(order.CustomerName)} · ${escapeHtml(order.RestaurantName)} · ${formatDateTime(order.OrderDate)} · ` +
      `total <strong>${formatMoney(order.TotalAmount)}</strong> · current status ` +
      `<span class="badge ${statusClass(order.StatusName)}">${escapeHtml(order.StatusName)}</span>`;

    statusItemsBody.innerHTML = order.items.map((item) => `
      <tr>
        <td data-label="Item">${escapeHtml(item.ItemName)}</td>
        <td data-label="Qty" class="num">${item.Quantity}</td>
        <td data-label="Price paid" class="num">${formatMoney(item.PriceAtOrderTime)}</td>
        <td data-label="Subtotal" class="num">${formatMoney(item.Subtotal)}</td>
      </tr>`).join('');

    showFieldErrors(statusForm, {});
    newStatusSelect.innerHTML = '';
    if (order.isFinal || order.allowedStatuses.length === 0) {
      // Delivered / Cancelled: nothing can be changed
      statusField.hidden = true;
      statusSaveBtn.hidden = true;
      statusCancelBtn.textContent = 'Close';
      showMessage(statusMessage, 'info',
        `This order is ${order.StatusName}. ${order.StatusName} orders are final and cannot be changed.`);
    } else {
      statusField.hidden = false;
      statusSaveBtn.hidden = false;
      statusCancelBtn.textContent = 'Cancel';
      showMessage(statusMessage, '', '');
      newStatusSelect.innerHTML = '<option value="">Choose new status…</option>' +
        order.allowedStatuses.map((s) => `<option value="${s.StatusID}">${escapeHtml(s.StatusName)}</option>`).join('');
    }

    statusForm.hidden = false;
    statusForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showMessage(message, 'error', err.message);
  }
}

function closeStatusForm() {
  statusOrderId = null;
  statusForm.reset();
  showFieldErrors(statusForm, {});
  showMessage(statusMessage, '', '');
  statusForm.hidden = true;
}

async function saveStatus(event) {
  event.preventDefault();
  if (!newStatusSelect.value) {
    showFieldErrors(statusForm, { statusId: 'Please choose a new status.' });
    showMessage(statusMessage, 'error', 'Please choose a new status.');
    return;
  }

  statusSaveBtn.disabled = true;
  try {
    const result = await api(`/api/orders/${statusOrderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ statusId: Number(newStatusSelect.value) }),
    });
    closeStatusForm();
    await runSearch(result.orderId);   // reload from MySQL, keep current filters
    showMessage(message, result.changed ? 'success' : 'info', (result.changed ? '✅ ' : '') + result.message);
  } catch (err) {
    showFieldErrors(statusForm, err.fields || {});
    showMessage(statusMessage, 'error', err.message);
  } finally {
    statusSaveBtn.disabled = false;
  }
}

function cancelStatusForm() {
  const hadChoice = newStatusSelect.value !== '';
  closeStatusForm();
  if (hadChoice) showMessage(message, 'info', 'Cancelled. The order status was not changed.');
}

tbody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-status-id]');
  if (button) openStatusForm(Number(button.dataset.statusId));
});
statusForm.addEventListener('submit', saveStatus);
statusCancelBtn.addEventListener('click', cancelStatusForm);

// =====================================================================
// Search form events
// =====================================================================
form.addEventListener('submit', (event) => {
  event.preventDefault();
  runSearch();
});

resetBtn.addEventListener('click', () => {
  form.reset();
  clearCustomerFilter();   // also clears the hidden customer filter, then searches
});

applyCustomerFromUrl();
loadDropdowns()
  .catch((err) => showMessage(message, 'error', 'Could not load filter options: ' + err.message))
  .finally(runSearch);
