// =====================================================================
// menu.js - Menu Search page
// The browser only collects the filters, checks them, and displays results.
// The actual filtering is done by MySQL on the server.
// =====================================================================

const form        = document.getElementById('search-form');
const searchBtn   = document.getElementById('search-btn');
const resetBtn    = document.getElementById('reset-btn');
const message     = document.getElementById('message');
const summary     = document.getElementById('summary');
const table       = document.getElementById('results');
const tbody       = table.querySelector('tbody');
const restaurantSelect = document.getElementById('restaurantId');
const minPriceInput    = document.getElementById('minPrice');
const maxPriceInput    = document.getElementById('maxPrice');

/** Fill the Restaurant dropdown from the database. */
async function loadRestaurants() {
  const restaurants = await api('/api/restaurants');
  restaurants.forEach((r) => {
    const option = document.createElement('option');
    option.value = r.RestaurantID;
    option.textContent = r.RestaurantName;
    restaurantSelect.appendChild(option);
  });
}

/**
 * Browser-side validation (the server checks again).
 * Returns an error message, or '' if the form is valid.
 */
function validateForm() {
  [minPriceInput, maxPriceInput].forEach((el) => el.classList.remove('invalid'));

  for (const el of [minPriceInput, maxPriceInput]) {
    if (el.validity.badInput) {
      el.classList.add('invalid');
      return `${el.labels[0].textContent} must be a number.`;
    }
    if (el.value !== '' && (Number(el.value) < 0 || !/^\d+(\.\d{1,2})?$/.test(el.value))) {
      el.classList.add('invalid');
      return `${el.labels[0].textContent} must be 0 or more with at most 2 decimal places.`;
    }
  }

  if (minPriceInput.value !== '' && maxPriceInput.value !== '' &&
      Number(minPriceInput.value) > Number(maxPriceInput.value)) {
    minPriceInput.classList.add('invalid');
    maxPriceInput.classList.add('invalid');
    return 'Min price cannot be greater than max price.';
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

/** Draw the results table. All data is escaped before inserting into HTML. */
function renderResults(items) {
  tbody.innerHTML = items.map((item) => `
    <tr>
      <td data-label="Item"><strong>${escapeHtml(item.ItemName)}</strong></td>
      <td data-label="Restaurant">${escapeHtml(item.RestaurantName)}</td>
      <td data-label="Description">${escapeHtml(item.Description) || '<span class="hint">—</span>'}</td>
      <td data-label="Price" class="num">${formatMoney(item.Price)}</td>
      <td data-label="Status">${item.AvailabilityStatus
        ? '<span class="badge yes">Available</span>'
        : '<span class="badge no">Unavailable</span>'}</td>
    </tr>`).join('');

  table.hidden = items.length === 0;
  summary.textContent = items.length === 1 ? 'Found 1 item.' : `Found ${items.length} items.`;
  if (items.length === 0) showMessage(message, 'info', 'No menu items match your filters. Try removing some filters.');
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
    const items = await api('/api/menu-items' + (query ? '?' + query : ''));
    renderResults(items);
  } catch (err) {
    table.hidden = true;
    summary.textContent = '';
    showMessage(message, 'error', err.message);
  } finally {
    searchBtn.disabled = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();   // stay on this page; we fetch results with JavaScript
  runSearch();
});

resetBtn.addEventListener('click', () => {
  form.reset();
  runSearch();
});

// On page load: fill the dropdown, then show all items
loadRestaurants()
  .catch((err) => showMessage(message, 'error', 'Could not load restaurants: ' + err.message))
  .finally(runSearch);
