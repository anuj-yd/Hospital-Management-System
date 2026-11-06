/**
 * State-transition maps — single source of truth for every status-bearing entity.
 * Each key is a current status, value is an array of valid next statuses.
 */

export const APPOINTMENT_TRANSITIONS = Object.freeze({
  SCHEDULED:   ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED:   ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN:  ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED:   [],
  CANCELLED:   [],
  NO_SHOW:     [],
});

export const VISIT_TRANSITIONS = Object.freeze({
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED:   [],
});

export const INVOICE_TRANSITIONS = Object.freeze({
  DRAFT:          ['ISSUED', 'CANCELLED'],
  ISSUED:         ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'CANCELLED', 'REFUNDED'],
  PAID:           ['REFUNDED'],
  CANCELLED:      [],
  REFUNDED:       [],
});

/**
 * Validate a state transition.
 * @param {Object} map   One of the transition maps above
 * @param {string} from  Current status
 * @param {string} to    Desired status
 * @returns {boolean}
 */
export function isValidTransition(map, from, to) {
  const allowed = map[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
