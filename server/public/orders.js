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

/** Draw the results table (all text escaped). */
function renderResults(orders) {
  tbody.innerHTML = orders.map((o) => `
    <tr>
      <td data-label="Order #"><strong>#${o.OrderID}</strong></td>
      <td data-label="Date">${formatDateTime(o.OrderDate)}</td>
      <td data-label="Customer">${escapeHtml(o.CustomerName)}</td>
      <td data-label="Restaurant">${escapeHtml(o.RestaurantName)}</td>
      <td data-label="Items" class="num">${o.TotalQuantity}
        <span class="text-muted">(${o.ItemCount} ${o.ItemCount === 1 ? 'line' : 'lines'})</span></td>
      <td data-label="Total" class="num"><strong>${formatMoney(o.TotalAmount)}</strong></td>
      <td data-label="Status"><span class="badge ${statusClass(o.StatusName)}">${escapeHtml(o.StatusName)}</span></td>
      <td data-label="Delivery address">${escapeHtml(o.DeliveryAddress)}</td>
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
async function runSearch() {
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
    renderResults(orders);
  } catch (err) {
    table.hidden = true;
    summary.textContent = '';
    showMessage(message, 'error', err.message);
  } finally {
    searchBtn.disabled = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  runSearch();
});

resetBtn.addEventListener('click', () => {
  form.reset();
  runSearch();
});

loadDropdowns()
  .catch((err) => showMessage(message, 'error', 'Could not load filter options: ' + err.message))
  .finally(runSearch);
