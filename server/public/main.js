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
    throw new Error((data && data.error) || `Request failed (HTTP ${res.status}).`);
  }
  return data;
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

/** Highlight the navigation link for the current page. */
function markActiveNav() {
  const current = window.location.pathname === '/' ? '/index.html' : window.location.pathname;
  document.querySelectorAll('.nav a').forEach((link) => {
    const target = link.getAttribute('href') === '/' ? '/index.html' : link.getAttribute('href');
    if (target === current) link.classList.add('active');
  });
}

document.addEventListener('DOMContentLoaded', markActiveNav);
