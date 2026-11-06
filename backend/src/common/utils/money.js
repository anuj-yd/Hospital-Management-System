/**
 * Money helpers — store everything as integer paise (1 INR = 100 paise).
 * Never use floating-point for currency.
 */

/**
 * Convert rupees (number or string) to paise.
 * @param {number|string} rupees
 * @returns {number} integer paise
 */
export function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

/**
 * Convert paise to rupees for display.
 * @param {number} paise
 * @returns {string} e.g. "1500.00"
 */
export function toRupees(paise) {
  return (paise / 100).toFixed(2);
}

/**
 * Format paise as a human-readable INR string.
 * @param {number} paise
 * @returns {string} e.g. "₹1,500.00"
 */
export function formatINR(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(paise / 100);
}
