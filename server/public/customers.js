// =====================================================================
// customers.js - Customer search + Add customer
// (M8 will add "Edit" using the same form.)
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
const FIELDS = ['firstName', 'lastName', 'email', 'phoneNumber', 'address'];

/** Draw the results table (all text escaped). highlightId marks a new row. */
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

// ---------- Add customer form ----------

function openForm() {
  customerForm.reset();
  showFieldErrors(customerForm, {});
  showMessage(formMessage, '', '');
  customerForm.hidden = false;
  addBtn.hidden = true;
  document.getElementById('firstName').focus();
}

function closeForm() {
  customerForm.reset();
  showFieldErrors(customerForm, {});
  showMessage(formMessage, '', '');
  customerForm.hidden = true;
  addBtn.hidden = false;
}

/** True if the user has typed anything into the form. */
function formHasInput() {
  return FIELDS.some((f) => document.getElementById(f).value.trim() !== '');
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
    const result = await api('/api/customers', { method: 'POST', body: JSON.stringify(data) });
    closeForm();
    // Reload the list from MySQL (proves it was saved) and highlight the new row
    searchInput.value = '';
    await runSearch(result.customer.CustomerID);
    showMessage(message, 'success', '✅ ' + result.message);
  } catch (err) {
    // Server validation (400) or database constraint (e.g. duplicate email, 409)
    showFieldErrors(customerForm, err.fields || {});
    showMessage(formMessage, 'error', err.message);
  } finally {
    saveBtn.disabled = false;
  }
}

function cancelForm() {
  if (formHasInput() && !confirm('Discard this new customer? Nothing will be saved.')) return;
  closeForm();
  showMessage(message, 'info', 'Cancelled. No customer was added.');
}

// ---------- Events ----------
addBtn.addEventListener('click', openForm);
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
