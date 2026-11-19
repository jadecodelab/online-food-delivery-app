// =====================================================================
// validators.js - Server-side input validation.
//
// The browser also validates, but a user can bypass the browser (e.g. by
// typing a URL), so the server must check every value again.
// Each helper returns a clean value, null (= "not provided"), or throws a
// ValidationError, which index.js turns into a 400 response with the message.
// =====================================================================

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

const isEmpty = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Optional free text (e.g. a search keyword). */
function optionalText(value, label, maxLength = 100) {
  if (isEmpty(value)) return null;
  if (typeof value !== 'string') throw new ValidationError(`${label} must be a single text value.`);
  const text = value.trim();
  if (text.length > maxLength) throw new ValidationError(`${label} must be at most ${maxLength} characters.`);
  return text;
}

/** Optional ID: a positive whole number. */
function optionalId(value, label) {
  if (isEmpty(value)) return null;
  const text = String(value).trim();
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 2147483647) {
    throw new ValidationError(`${label} must be a positive whole number.`);
  }
  return Number(text);
}

/** Optional money amount: 0 or more, at most 2 decimals, fits DECIMAL(8,2). */
function optionalMoney(value, label) {
  if (isEmpty(value)) return null;
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new ValidationError(`${label} must be a number of 0 or more with at most 2 decimal places.`);
  }
  const amount = Number(text);
  if (amount > 999999.99) throw new ValidationError(`${label} must be at most 999999.99.`);
  return amount;
}

/** Optional true/false flag ("true"/"false" or "1"/"0"). */
function optionalBoolean(value, label) {
  if (isEmpty(value)) return null;
  const text = String(value).trim().toLowerCase();
  if (text === 'true' || text === '1') return true;
  if (text === 'false' || text === '0') return false;
  throw new ValidationError(`${label} must be true or false.`);
}

/** Optional calendar date in YYYY-MM-DD format (must be a real date). */
function optionalDate(value, label) {
  if (isEmpty(value)) return null;
  const text = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) {
    const [, y, m, d] = match.map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    // Rejects impossible dates such as 2026-02-30
    if (date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d) {
      return text;
    }
  }
  throw new ValidationError(`${label} must be a valid date (YYYY-MM-DD).`);
}

/**
 * Escape LIKE wildcards so user input is matched literally.
 * Without this, searching for "%" would match every row.
 */
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (ch) => '\\' + ch);
}

module.exports = {
  ValidationError,
  optionalText,
  optionalId,
  optionalMoney,
  optionalBoolean,
  optionalDate,
  escapeLike,
};
