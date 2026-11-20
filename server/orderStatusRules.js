// =====================================================================
// orderStatusRules.js - Which order status changes are allowed.
//
//   Placed ──► Preparing ──► Out for Delivery ──► Delivered (final)
//     │            │
//     └────────────┴──► Cancelled (final)
//
// - Status may move forward one or more steps (never backward).
// - Delivered and Cancelled are final.
// - An order can only be cancelled before it is Out for Delivery.
//
// Rules use status NAMES (from the ORDER_STATUS lookup table), not IDs.
// =====================================================================

const FLOW = ['Placed', 'Preparing', 'Out for Delivery', 'Delivered'];
const CANCELLED = 'Cancelled';
const CANCELLABLE = ['Placed', 'Preparing'];

function isFinal(statusName) {
  return statusName === 'Delivered' || statusName === CANCELLED;
}

/**
 * Can an order move from status `from` to status `to`?
 * Returns { ok: true } or { ok: false, reason: '...' }.
 */
function checkStatusChange(from, to) {
  if (from === to) return { ok: true };
  if (isFinal(from)) {
    return { ok: false, reason: `This order is ${from}. ${from} orders are final and cannot be changed.` };
  }
  if (to === CANCELLED) {
    return CANCELLABLE.includes(from)
      ? { ok: true }
      : { ok: false, reason: `An order that is ${from} can no longer be cancelled.` };
  }
  const fromStep = FLOW.indexOf(from);
  const toStep = FLOW.indexOf(to);
  if (fromStep === -1 || toStep === -1) {
    return { ok: false, reason: `Changing from ${from} to ${to} is not supported.` };
  }
  if (toStep < fromStep) {
    return { ok: false, reason: `An order cannot move back from ${from} to ${to}.` };
  }
  return { ok: true };
}

/** From a list of { StatusID, StatusName }, keep the statuses `current` may change to. */
function allowedNextStatuses(current, allStatuses) {
  return allStatuses.filter((s) => s.StatusName !== current && checkStatusChange(current, s.StatusName).ok);
}

module.exports = { checkStatusChange, allowedNextStatuses, isFinal };
