// =====================================================================
// customers.js - Customer search + Add customer + Edit customer
// The same form is used for adding and editing:
//   editingId === null -> Add mode  (POST /api/customers)
//   editingId === 5    -> Edit mode (PUT  /api/customers/5)
// =====================================================================

// ---------- Search ----------
const searchForm  = document.getElementById('search-form');
const searchInput = document.getElementById('search');
const searchBtn   = document.getElementById('search-btn');
const resetBtn    = document.getElementById('reset-btn');
const message     = document.getElementById('message');
const summary     = document.getElementById('summary');
const table       = document.getElementById('results');
const tbody       = table.querySelector('tbody');

// ---------- Add form ----------
const addBtn       = document.getElementById('add-btn');
const customerForm = document.getElementById('customer-form');
const formMessage  = document.getElementById('form-message');
const saveBtn      = document.getElementById('save-btn');
const cancelBtn    = document.getElementById('cancel-btn');
const formTitle    = document.getElementById('form-title');
const FIELDS = ['firstName', 'lastName', 'email', 'phoneNumber', 'address'];

let editingId = null;        // null = adding; a number = editing that customer
let originalValues = null;   // values loaded for editing (to detect unsaved changes)

/** Draw the results table (all text escaped). highlightId marks a new/updated row. */
function renderResults(customers, highlightId = null) {
  tbody.innerHTML = customers.map((c) => `
    <tr${c.CustomerID === highlightId ? ' class="row-new"' : ''}>
      <td data-label="ID">${c.CustomerID}</td>
      <td data-label="Name"><strong>${escapeHtml(c.FirstName)} ${escapeHtml(c.LastName)}</strong></td>
      <td data-label="Email">${escapeHtml(c.Email)}</td>
      <td data-label="Phone">${escapeHtml(c.PhoneNumber)}</td>
      <td data-label="Address">${escapeHtml(c.Address)}</td>
      <td data-label="Orders" class="num">${c.OrderCount > 0
        ? `<a href="/orders.html?customerId=${c.CustomerID}">${c.OrderCount} — view</a>`
        : '<span class="text-muted">0</span>'}</td>
      <td data-label="Actions">
        <button type="button" class="btn btn-secondary btn-small" data-edit-id="${c.CustomerID}"
                aria-label="Edit ${escapeHtml(c.FirstName)} ${escapeHtml(c.LastName)}">Edit</button>
      </td>
    </tr>`).join('');

  table.hidden = customers.length === 0;
  summary.textContent = customers.length === 1 ? 'Found 1 customer.' : `Found ${customers.length} customers.`;
  if (customers.length === 0) showMessage(message, 'info', 'No customers match your search.');
}

async function runSearch(highlightId = null) {
  showMessage(message, '', '');
  searchBtn.disabled = true;
  summary.textContent = 'Searching…';
  try {
    const search = searchInput.value.trim();
    const customers = await api('/api/customers' + (search ? '?search=' + encodeURIComponent(search) : ''));
    renderResults(customers, highlightId);
  } catch (err) {
    table.hidden = true;
    summary.textContent = '';
    showMessage(message, 'error', err.message);
  } finally {
    searchBtn.disabled = false;
  }
}

// ---------- Add / Edit customer form ----------

/** Open the form empty, for adding a new customer. */
function openForm() {
  editingId = null;
  originalValues = null;
  customerForm.reset();
  showFieldErrors(customerForm, {});
  showMessage(formMessage, '', '');
  formTitle.textContent = 'Add customer';
  saveBtn.textContent = 'Save customer';
  customerForm.hidden = false;
  addBtn.hidden = true;
  document.getElementById('firstName').focus();
}

/**
 * Open the form filled with one customer's current data, for editing.
 * The data is loaded fresh from MySQL (not copied from the table on screen).
 */
async function openEditForm(customerId) {
  if (!customerForm.hidden && formHasUnsavedChanges() &&
      !confirm('Discard your unsaved changes in the open form?')) return;
  try {
    const c = await api(`/api/customers/${customerId}`);
    editingId = c.CustomerID;
    originalValues = {
      firstName: c.FirstName, lastName: c.LastName, email: c.Email,
      phoneNumber: c.PhoneNumber, address: c.Address,
    };
    FIELDS.forEach((f) => { document.getElementById(f).value = originalValues[f]; });
    showFieldErrors(customerForm, {});
    showMessage(formMessage, '', '');
    formTitle.textContent = `Edit customer #${c.CustomerID}`;
    saveBtn.textContent = 'Save changes';
    customerForm.hidden = false;
    addBtn.hidden = true;
    customerForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('firstName').focus({ preventScroll: true });
  } catch (err) {
    showMessage(message, 'error', err.message);   // e.g. 404 customer not found
  }
}

function closeForm() {
  editingId = null;
  originalValues = null;
  customerForm.reset();
  showFieldErrors(customerForm, {});
  showMessage(formMessage, '', '');
  customerForm.hidden = true;
  addBtn.hidden = false;
}

/** Add mode: anything typed? Edit mode: anything different from the loaded values? */
function formHasUnsavedChanges() {
  if (editingId === null) {
    return FIELDS.some((f) => document.getElementById(f).value.trim() !== '');
  }
  return FIELDS.some((f) => document.getElementById(f).value.trim() !== originalValues[f]);
}

/** Read the form into a plain object (sent as JSON). */
function readForm() {
  const data = {};
  FIELDS.forEach((f) => { data[f] = document.getElementById(f).value.trim(); });
  return data;
}

/**
 * Browser-side validation, mirroring the server rules so the user gets
 * instant feedback. The server validates again (it is the real guard).
 */
function validateCustomerForm(data) {
  const errors = {};
  const labels = {
    firstName: 'First name', lastName: 'Last name', email: 'Email',
    phoneNumber: 'Phone number', address: 'Address',
  };
  FIELDS.forEach((f) => { if (!data[f]) errors[f] = `${labels[f]} is required.`; });

  const namePattern = /^\p{L}[\p{L} '.-]*$/u;
  if (data.firstName && !namePattern.test(data.firstName)) {
    errors.firstName = 'First name can only contain letters, spaces, hyphens, apostrophes, and periods.';
  }
  if (data.lastName && !namePattern.test(data.lastName)) {
    errors.lastName = 'Last name can only contain letters, spaces, hyphens, apostrophes, and periods.';
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Email must look like name@example.com.';
  }
  if (data.phoneNumber) {
    const digits = data.phoneNumber.replace(/\D/g, '').length;
    if (!/^[0-9+()\-.\s]+$/.test(data.phoneNumber) || digits < 7 || digits > 15) {
      errors.phoneNumber = 'Phone number must have 7-15 digits (you may also use spaces, +, -, ( ) and .).';
    }
  }
  return errors;
}

async function saveCustomer(event) {
  event.preventDefault();
  const data = readForm();

  const errors = validateCustomerForm(data);
  if (Object.keys(errors).length > 0) {
    showFieldErrors(customerForm, errors);
    showMessage(formMessage, 'error', 'Please correct the highlighted fields.');
    return;
  }

  showFieldErrors(customerForm, {});
  showMessage(formMessage, '', '');
  saveBtn.disabled = true;
  try {
    const isEdit = editingId !== null;
    const result = isEdit
      ? await api(`/api/customers/${editingId}`, { method: 'PUT', body: JSON.stringify(data) })
      : await api('/api/customers', { method: 'POST', body: JSON.stringify(data) });
    closeForm();
    // Reload the list from MySQL (proves it was saved) and highlight the row.
    // After adding, clear the search so the new customer is visible;
    // after editing, keep the user's current search.
    if (!isEdit) searchInput.value = '';
    await runSearch(result.customer.CustomerID);
    const changed = !isEdit || result.changed;
    showMessage(message, changed ? 'success' : 'info', (changed ? '✅ ' : '') + result.message);
  } catch (err) {
    // Server validation (400) or database constraint (e.g. duplicate email, 409)
    showFieldErrors(customerForm, err.fields || {});
    showMessage(formMessage, 'error', err.message);
  } finally {
    saveBtn.disabled = false;
  }
}

function cancelForm() {
  const isEdit = editingId !== null;
  const question = isEdit
    ? 'Discard your changes? The customer will stay as it was.'
    : 'Discard this new customer? Nothing will be saved.';
  if (formHasUnsavedChanges() && !confirm(question)) return;
  closeForm();
  showMessage(message, 'info', isEdit ? 'Cancelled. No changes were saved.' : 'Cancelled. No customer was added.');
}

// ---------- Events ----------
addBtn.addEventListener('click', openForm);

// One listener for all Edit buttons in the table (rows are redrawn after each search)
tbody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-edit-id]');
  if (button) openEditForm(Number(button.dataset.editId));
});
customerForm.addEventListener('submit', saveCustomer);
cancelBtn.addEventListener('click', cancelForm);

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  runSearch();
});

resetBtn.addEventListener('click', () => {
  searchForm.reset();
  runSearch();
});

runSearch();
