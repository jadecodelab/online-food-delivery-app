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
function renderResults(items, highlightId = null) {
  tbody.innerHTML = items.map((item) => `
    <tr${item.ItemID === highlightId ? ' class="row-new"' : ''}>
      <td data-label="Item"><strong>${escapeHtml(item.ItemName)}</strong></td>
      <td data-label="Restaurant">${escapeHtml(item.RestaurantName)}</td>
      <td data-label="Description">${escapeHtml(item.Description) || '<span class="hint">—</span>'}</td>
      <td data-label="Price" class="num">${formatMoney(item.Price)}</td>
      <td data-label="Status">${item.AvailabilityStatus
        ? '<span class="badge yes">Available</span>'
        : '<span class="badge no">Unavailable</span>'}</td>
      <td data-label="Actions">
        <button type="button" class="btn btn-secondary btn-small" data-edit-id="${item.ItemID}"
                aria-label="Edit ${escapeHtml(item.ItemName)}">Edit</button>
      </td>
    </tr>`).join('');

  table.hidden = items.length === 0;
  summary.textContent = items.length === 1 ? 'Found 1 item.' : `Found ${items.length} items.`;
  if (items.length === 0) showMessage(message, 'info', 'No menu items match your filters. Try removing some filters.');
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
    const items = await api('/api/menu-items' + (query ? '?' + query : ''));
    renderResults(items, highlightId);
  } catch (err) {
    table.hidden = true;
    summary.textContent = '';
    showMessage(message, 'error', err.message);
  } finally {
    searchBtn.disabled = false;
  }
}

// =====================================================================
// Edit menu item
// =====================================================================
const itemForm       = document.getElementById('item-form');
const itemFormTitle  = document.getElementById('item-form-title');
const itemMessage    = document.getElementById('item-form-message');
const itemRestaurant = document.getElementById('item-restaurant');
const itemName       = document.getElementById('item-name');
const itemDesc       = document.getElementById('item-description');
const itemPrice      = document.getElementById('item-price');
const itemAvailable  = document.getElementById('item-available');
const itemSaveBtn    = document.getElementById('item-save-btn');
const itemCancelBtn  = document.getElementById('item-cancel-btn');

let editingItemId = null;
let originalItem = null;   // values as loaded, to detect unsaved changes

function readItemForm() {
  return {
    itemName: itemName.value.trim(),
    description: itemDesc.value.trim(),
    price: itemPrice.value.trim(),
    availabilityStatus: itemAvailable.value,
  };
}

function itemFormChanged() {
  if (!originalItem) return false;
  const now = readItemForm();
  return Object.keys(now).some((key) => now[key] !== originalItem[key]);
}

/** Load the item fresh from MySQL and open the form. */
async function openItemForm(itemId) {
  if (!itemForm.hidden && itemFormChanged() &&
      !confirm('Discard your unsaved changes in the open form?')) return;
  try {
    const item = await api(`/api/menu-items/${itemId}`);
    editingItemId = item.ItemID;
    itemFormTitle.textContent = `Edit menu item #${item.ItemID}`;
    itemRestaurant.value = item.RestaurantName;
    itemName.value = item.ItemName;
    itemDesc.value = item.Description || '';
    itemPrice.value = Number(item.Price).toFixed(2);
    itemAvailable.value = item.AvailabilityStatus ? 'true' : 'false';
    originalItem = readItemForm();

    showFieldErrors(itemForm, {});
    showMessage(itemMessage, '', '');
    itemForm.hidden = false;
    itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    itemName.focus({ preventScroll: true });
  } catch (err) {
    showMessage(message, 'error', err.message);
  }
}

function closeItemForm() {
  editingItemId = null;
  originalItem = null;
  itemForm.reset();
  showFieldErrors(itemForm, {});
  showMessage(itemMessage, '', '');
  itemForm.hidden = true;
}

/** Browser-side validation (the server checks again). */
function validateItemForm(data) {
  const errors = {};
  if (!data.itemName) errors.itemName = 'Item name is required.';
  if (data.description.length > 255) errors.description = 'Description must be at most 255 characters.';
  if (itemPrice.validity.badInput) errors.price = 'Price must be a number.';
  else if (data.price === '') errors.price = 'Price is required.';
  else if (!/^\d+(\.\d{1,2})?$/.test(data.price)) errors.price = 'Price must be 0 or more with at most 2 decimal places.';
  else if (Number(data.price) > 999999.99) errors.price = 'Price must be at most 999999.99.';
  return errors;
}

async function saveItem(event) {
  event.preventDefault();
  const data = readItemForm();
  const errors = validateItemForm(data);
  if (Object.keys(errors).length > 0) {
    showFieldErrors(itemForm, errors);
    showMessage(itemMessage, 'error', 'Please correct the highlighted fields.');
    return;
  }

  showFieldErrors(itemForm, {});
  showMessage(itemMessage, '', '');
  itemSaveBtn.disabled = true;
  try {
    const result = await api(`/api/menu-items/${editingItemId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, availabilityStatus: data.availabilityStatus === 'true' }),
    });
    closeItemForm();
    await runSearch(result.item.ItemID);   // reload from MySQL, keep current filters
    showMessage(message, result.changed ? 'success' : 'info', (result.changed ? '✅ ' : '') + result.message);
  } catch (err) {
    // Validation (400), duplicate name in same restaurant (409), not found (404)
    showFieldErrors(itemForm, err.fields || {});
    showMessage(itemMessage, 'error', err.message);
  } finally {
    itemSaveBtn.disabled = false;
  }
}

function cancelItemForm() {
  if (itemFormChanged() && !confirm('Discard your changes? The menu item will stay as it was.')) return;
  const hadChanges = itemFormChanged();
  closeItemForm();
  if (hadChanges) showMessage(message, 'info', 'Cancelled. No changes were saved.');
}

tbody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-edit-id]');
  if (button) openItemForm(Number(button.dataset.editId));
});
itemForm.addEventListener('submit', saveItem);
itemCancelBtn.addEventListener('click', cancelItemForm);

// =====================================================================
// Search form events
// =====================================================================
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
