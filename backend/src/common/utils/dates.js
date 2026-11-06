import { DateTime } from 'luxon';
import { env } from '../../config/env.js';

/**
 * Get the current time in UTC.
 */
export function nowUtc() {
  return DateTime.utc();
}

/**
 * Get current time in the clinic timezone.
 */
export function nowClinic() {
  return DateTime.now().setZone(env.CLINIC_TZ);
}

/**
 * Convert a JS Date (or ISO string) to clinic-local DateTime.
 */
export function toClinicTime(date) {
  return DateTime.fromJSDate(date instanceof Date ? date : new Date(date)).setZone(env.CLINIC_TZ);
}

/**
 * Convert a clinic-local date string (yyyy-MM-dd) + time string (HH:mm) to a UTC JS Date.
 */
export function clinicToUtc(dateStr, timeStr) {
  return DateTime.fromFormat(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', {
    zone: env.CLINIC_TZ,
  }).toUTC().toJSDate();
}

/**
 * Format a date for display in clinic timezone.
 */
export function formatClinic(date, format = 'dd MMM yyyy, hh:mm a') {
  return toClinicTime(date).toFormat(format);
}

/**
 * Get the ISO day-of-week (1=Mon..7=Sun) for a date string.
 */
export function isoDayOfWeek(dateStr) {
  return DateTime.fromISO(dateStr).weekday;
}

/**
 * Parse a date string and return a JS Date for Prisma.
 */
export function parseDate(dateStr) {
  const dt = DateTime.fromISO(dateStr, { zone: 'utc' });
  if (!dt.isValid) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return dt.toJSDate();
}
