/**
 * State-transition maps — single source of truth for every status-bearing entity.
 * Each key is a current status, value is an array of valid next statuses.
 */

export const APPOINTMENT_TRANSITIONS = Object.freeze({
  SCHEDULED:   ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN:  ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
  NO_SHOW:     [],
});

export const VISIT_TRANSITIONS = Object.freeze({
  OPEN:        ['CLOSED'],
  CLOSED:      [],
});

export const INVOICE_TRANSITIONS = Object.freeze({
  DRAFT:          ['ISSUED', 'VOID'],
  ISSUED:         ['PARTIALLY_PAID', 'PAID', 'VOID'],
  PARTIALLY_PAID: ['PAID', 'VOID'],
  PAID:           [],
  VOID:           [],
});

/**
 * Validate an appointment status transition.
 * @param {string} from Current status
 * @param {string} to Desired status
 * @returns {boolean}
 */
export function isValidAppointmentTransition(from, to) {
  const allowed = APPOINTMENT_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Generic transition validator.
 * @param {Object} map Transition map
 * @param {string} from Current status
 * @param {string} to Desired status
 * @returns {boolean}
 */
export function isValidTransition(map, from, to) {
  const allowed = map[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
