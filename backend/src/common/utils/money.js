import { Prisma } from '@prisma/client';

/**
 * Decimal-safe money utilities.
 * Handles financial calculations accurately without floating-point errors.
 */

/**
 * Coerce a value into a Prisma.Decimal.
 * @param {string|number|Prisma.Decimal} val
 * @returns {Prisma.Decimal}
 */
export function toDecimal(val) {
  if (val instanceof Prisma.Decimal) return val;
  if (val === null || val === undefined) return new Prisma.Decimal(0);
  return new Prisma.Decimal(String(val));
}

/**
 * Convert currency amount (e.g. 1500.50) to integer subunits (paise / cents).
 * @param {string|number|Prisma.Decimal} amount
 * @returns {number}
 */
export function toPaise(amount) {
  const dec = toDecimal(amount);
  return Math.round(dec.mul(100).toNumber());
}

/**
 * Convert integer subunits (paise / cents) to Decimal currency.
 * @param {number} paise
 * @returns {Prisma.Decimal}
 */
export function fromPaise(paise) {
  return new Prisma.Decimal(paise).div(100);
}

/**
 * Exact Decimal addition: a + b
 */
export function addMoney(a, b) {
  return toDecimal(a).add(toDecimal(b));
}

/**
 * Exact Decimal subtraction: a - b
 */
export function subtractMoney(a, b) {
  return toDecimal(a).sub(toDecimal(b));
}

/**
 * Exact Decimal multiplication: amount * factor
 */
export function multiplyMoney(amount, factor) {
  return toDecimal(amount).mul(toDecimal(factor));
}

/**
 * Format Decimal currency to string with 2 decimal places.
 * @param {string|number|Prisma.Decimal} amount
 * @returns {string}
 */
export function formatMoney(amount) {
  return toDecimal(amount).toFixed(2);
}

/**
 * Format currency with locale and symbol.
 * @param {string|number|Prisma.Decimal} amount
 * @param {string} currency
 */
export function formatCurrency(amount, currency = 'INR') {
  const num = toDecimal(amount).toNumber();
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(num);
}
