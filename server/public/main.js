// =====================================================================
// main.js - shared helpers used by every page
// =====================================================================

/**
 * Call the server API and return the JSON data.
 * Throws an Error with the server's message if the request fails,
 * so pages can show it to the user.
 */
async function api(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error('Cannot reach the server. Is it running?');
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }

  if (!res.ok) {
    const error = new Error((data && data.error) || `Request failed (HTTP ${res.status}).`);
    error.status = res.status;
    error.fields = (data && data.fields) || null;   // per-field messages, if any
    throw error;
  }
  return data;
}

/**
 * Show per-field error messages under form inputs and highlight them.
 * Finds the input by name="<field>" (or id) inside the form, and the message
 * <span class="field-error"> by data-error-for="<field>" (or id="err-<field>").
 * Pass {} to clear all errors in the form.
 */
function showFieldErrors(formElement, errors) {
  formElement.querySelectorAll('.field-error').forEach((span) => { span.textContent = ''; });
  formElement.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));

  let first = null;
  Object.entries(errors || {}).forEach(([field, text]) => {
    const input = formElement.querySelector(`[name="${field}"]`) || formElement.querySelector(`#${field}`);
    const span = formElement.querySelector(`[data-error-for="${field}"]`)
      || formElement.querySelector(`#err-${field}`);
    if (input) {
      input.classList.add('invalid');
      input.setAttribute('aria-invalid', 'true');
      first = first || input;
    }
    if (span) span.textContent = text;
  });
  formElement.querySelectorAll('[aria-invalid]').forEach((el) => {
    if (!el.classList.contains('invalid')) el.removeAttribute('aria-invalid');
  });
  if (first) first.focus();
}

/** Show a success / error / info message in a .message element ('' clears it). */
function showMessage(element, type, text) {
  element.className = `message ${type}`;
  element.textContent = text;
}

/**
 * Escape text before putting it into HTML.
 * Prevents data such as "<script>" from being run as code (XSS).
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format a number as US dollars, e.g. 14.5 -> "$14.50". */
function formatMoney(amount) {
  return Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * Format MySQL 'YYYY-MM-DD HH:MM:SS' as e.g. "Nov 17, 2026, 12:10 PM".
 * Parsed manually so the browser's time zone does not shift the time.
 */
function formatDateTime(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(text || '');
  if (!m) return escapeHtml(text);
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** CSS class for an order status badge, e.g. "Out for Delivery" -> "status-out-for-delivery". */
function statusClass(statusName) {
  return 'status-' + String(statusName).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** Highlight the navigation link for the current page. */
function markActiveNav() {
  const current = window.location.pathname === '/' ? '/index.html' : window.location.pathname;
  document.querySelectorAll('.nav a').forEach((link) => {
    const target = link.getAttribute('href') === '/' ? '/index.html' : link.getAttribute('href');
    if (target === current) link.classList.add('active');
  });
}

document.addEventListener('DOMContentLoaded', markActiveNav);
