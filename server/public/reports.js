// =====================================================================
// reports.js - Reports page
// All grouping and totals are calculated by MySQL (GROUP BY + aggregates);
// this file only sends the filters and displays the rows it receives.
// =====================================================================

const filterForm = document.getElementById('filter-form');
const fromInput  = document.getElementById('from');
const toInput    = document.getElementById('to');
const cancelledInput = document.getElementById('includeCancelled');
const applyBtn   = document.getElementById('apply-btn');
const resetBtn   = document.getElementById('reset-btn');
const message    = document.getElementById('message');

const topForm    = document.getElementById('top-form');
const topMin     = document.getElementById('top-min');
const spendForm  = document.getElementById('spend-form');

const revenueBody = document.querySelector('#revenue-table tbody');
const topBody     = document.querySelector('#top-table tbody');
const spendBody   = document.querySelector('#spend-table tbody');

const dash = '<span class="text-muted">—</span>';

/** Shared filters (date range + cancelled) as URLSearchParams. */
function sharedParams() {
  const params = new URLSearchParams();
  if (fromInput.value) params.set('from', fromInput.value);
  if (toInput.value) params.set('to', toInput.value);
  if (cancelledInput.checked) params.set('includeCancelled', 'true');
  return params;
}

function validateFilters() {
  [fromInput, toInput, topMin].forEach((el) => el.classList.remove('invalid'));
  for (const el of [fromInput, toInput]) {
    if (el.validity.badInput) { el.classList.add('invalid'); return `${el.labels[0].textContent} is not a valid date.`; }
  }
  if (fromInput.value && toInput.value && fromInput.value > toInput.value) {
    fromInput.classList.add('invalid'); toInput.classList.add('invalid');
    return 'From date cannot be after To date.';
  }
  if (topMin.value !== '' && !/^[1-9]\d*$/.test(topMin.value)) {
    topMin.classList.add('invalid');
    return 'Min units sold must be a whole number of 1 or more.';
  }
  return '';
}

function emptyRow(colspan, text) {
  return `<tr><td colspan="${colspan}" class="text-muted">${text}</td></tr>`;
}

// ---------- Report 1 ----------
async function loadRevenue() {
  const rows = await api('/api/reports/restaurant-revenue?' + sharedParams());
  revenueBody.innerHTML = rows.length === 0 ? emptyRow(5, 'No restaurants.') : rows.map((r) => `
    <tr>
      <td data-label="Restaurant"><strong>${escapeHtml(r.RestaurantName)}</strong></td>
      <td data-label="Orders" class="num">${r.OrderCount}</td>
      <td data-label="Revenue" class="num"><strong>${formatMoney(r.Revenue)}</strong></td>
      <td data-label="Avg order" class="num">${r.AvgOrderValue === null ? dash : formatMoney(r.AvgOrderValue)}</td>
      <td data-label="Largest order" class="num">${r.LargestOrder === null ? dash : formatMoney(r.LargestOrder)}</td>
    </tr>`).join('');
}

// ---------- Report 2 ----------
async function loadTopItems() {
  const params = sharedParams();
  new FormData(topForm).forEach((value, key) => { if (String(value).trim()) params.set(key, String(value).trim()); });
  const rows = await api('/api/reports/top-items?' + params);
  topBody.innerHTML = rows.length === 0 ? emptyRow(6, 'No items sold for these filters.') : rows.map((r, i) => `
    <tr>
      <td data-label="#" class="num">${i + 1}</td>
      <td data-label="Item"><strong>${escapeHtml(r.ItemName)}</strong></td>
      <td data-label="Restaurant">${escapeHtml(r.RestaurantName)}</td>
      <td data-label="Units sold" class="num"><strong>${r.UnitsSold}</strong></td>
      <td data-label="Orders" class="num">${r.OrderCount}</td>
      <td data-label="Revenue" class="num">${formatMoney(r.Revenue)}</td>
    </tr>`).join('');
}

// ---------- Report 3 ----------
async function loadSpending() {
  const params = sharedParams();
  if (document.getElementById('only-with-orders').checked) params.set('onlyWithOrders', 'true');
  const rows = await api('/api/reports/customer-spending?' + params);
  spendBody.innerHTML = rows.length === 0 ? emptyRow(6, 'No customers for these filters.') : rows.map((r) => `
    <tr>
      <td data-label="Customer"><strong>${escapeHtml(r.CustomerName)}</strong></td>
      <td data-label="Email">${escapeHtml(r.Email)}</td>
      <td data-label="Orders" class="num">${r.OrderCount}</td>
      <td data-label="Total spent" class="num"><strong>${formatMoney(r.TotalSpent)}</strong></td>
      <td data-label="Avg order" class="num">${r.AvgOrderValue === null ? dash : formatMoney(r.AvgOrderValue)}</td>
      <td data-label="Last order">${r.LastOrderDate ? formatDateTime(r.LastOrderDate) : dash}</td>
    </tr>`).join('');
}

/** Run one or more report loaders, showing any error in the message box. */
async function run(...loaders) {
  const error = validateFilters();
  if (error) { showMessage(message, 'error', error); return; }
  showMessage(message, '', '');
  applyBtn.disabled = true;
  try {
    await Promise.all(loaders.map((load) => load()));
  } catch (err) {
    showMessage(message, 'error', err.message);
  } finally {
    applyBtn.disabled = false;
  }
}

const runAll = () => run(loadRevenue, loadTopItems, loadSpending);

async function loadRestaurantOptions() {
  const restaurants = await api('/api/restaurants');
  const select = document.getElementById('top-restaurant');
  restaurants.forEach((r) => {
    const option = document.createElement('option');
    option.value = r.RestaurantID;
    option.textContent = r.RestaurantName;
    select.appendChild(option);
  });
}

// ---------- Events ----------
filterForm.addEventListener('submit', (event) => { event.preventDefault(); runAll(); });
resetBtn.addEventListener('click', () => { filterForm.reset(); runAll(); });

// Per-report controls refresh only their own report
topForm.addEventListener('change', () => run(loadTopItems));
topForm.addEventListener('submit', (event) => { event.preventDefault(); run(loadTopItems); });
spendForm.addEventListener('change', () => run(loadSpending));

loadRestaurantOptions()
  .catch((err) => showMessage(message, 'error', 'Could not load restaurants: ' + err.message))
  .finally(runAll);
