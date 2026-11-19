// =====================================================================
// customers.js - Customer search page
// (M7/M8 will add "Add customer" and "Edit" to this page.)
// =====================================================================

const form        = document.getElementById('search-form');
const searchInput = document.getElementById('search');
const searchBtn   = document.getElementById('search-btn');
const resetBtn    = document.getElementById('reset-btn');
const message     = document.getElementById('message');
const summary     = document.getElementById('summary');
const table       = document.getElementById('results');
const tbody       = table.querySelector('tbody');

/** Draw the results table (all text escaped). */
function renderResults(customers) {
  tbody.innerHTML = customers.map((c) => `
    <tr>
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

async function runSearch() {
  showMessage(message, '', '');
  searchBtn.disabled = true;
  summary.textContent = 'Searching…';
  try {
    const search = searchInput.value.trim();
    const customers = await api('/api/customers' + (search ? '?search=' + encodeURIComponent(search) : ''));
    renderResults(customers);
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

runSearch();
