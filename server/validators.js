// =====================================================================
// validators.js - Server-side input validation.
//
// The browser also validates, but a user can bypass the browser (e.g. by
// typing a URL), so the server must check every value again.
// Each helper returns a clean value, null (= "not provided"), or throws a
// ValidationError, which index.js turns into a 400 response with the message.
// =====================================================================

class ValidationError extends Error {
  /**
   * @param {string} message  overall message shown to the user
   * @param {object} [fields] optional per-field messages, e.g. { email: 'Email is required.' }
   */
  constructor(message, fields = null) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.fields = fields;
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

// ---------------------------------------------------------------------
// Form validation (insert / update): collects ALL field errors at once
// so the user can fix everything in one go.
// ---------------------------------------------------------------------

const NAME_PATTERN  = /^\p{L}[\p{L} '.-]*$/u;            // letters, spaces, ' . -
const PHONE_PATTERN = /^[0-9+()\-.\s]+$/;               // digits and + ( ) - . space
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;     // something@something.something

/**
 * Validate a required text field. Trims it and collapses repeated spaces.
 * Writes the clean value into data[key] or a message into errors[key].
 */
function requiredText(body, key, label, maxLength, data, errors) {
  const value = body[key];
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    errors[key] = `${label} is required.`;
    return;
  }
  if (typeof value !== 'string') {
    errors[key] = `${label} must be text.`;
    return;
  }
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length > maxLength) {
    errors[key] = `${label} must be at most ${maxLength} characters.`;
    return;
  }
  data[key] = text;
}

/**
 * Validate a customer form (used for both insert and update).
 * Returns clean data, or throws ValidationError with per-field messages.
 */
function validateCustomer(body) {
  body = body || {};
  const data = {};
  const errors = {};

  requiredText(body, 'firstName',   'First name',   50,  data, errors);
  requiredText(body, 'lastName',    'Last name',    50,  data, errors);
  requiredText(body, 'phoneNumber', 'Phone number', 20,  data, errors);
  requiredText(body, 'email',       'Email',        100, data, errors);
  requiredText(body, 'address',     'Address',      200, data, errors);

  if (data.firstName && !NAME_PATTERN.test(data.firstName)) {
    errors.firstName = 'First name can only contain letters, spaces, hyphens, apostrophes, and periods.';
  }
  if (data.lastName && !NAME_PATTERN.test(data.lastName)) {
    errors.lastName = 'Last name can only contain letters, spaces, hyphens, apostrophes, and periods.';
  }
  if (data.phoneNumber) {
    const digitCount = data.phoneNumber.replace(/\D/g, '').length;
    if (!PHONE_PATTERN.test(data.phoneNumber) || digitCount < 7 || digitCount > 15) {
      errors.phoneNumber = 'Phone number must have 7-15 digits (you may also use spaces, +, -, ( ) and .).';
    }
  }
  if (data.email && !EMAIL_PATTERN.test(data.email)) {
    errors.email = 'Email must look like name@example.com.';
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Please correct the highlighted fields.', errors);
  }
  return data;
}

module.exports = {
  ValidationError,
  validateCustomer,
  optionalText,
  optionalId,
  optionalMoney,
  optionalBoolean,
  optionalDate,
  escapeLike,
};
