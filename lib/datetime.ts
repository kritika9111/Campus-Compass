/** Format a date for a datetime-local input using the browser's local timezone. */
export function toLocalDateTimeInputValue(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

/** Format a date consistently in IST (Asia/Kolkata) to avoid SSR/client hydration mismatches. */
export function formatCampusDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...options }).format(parsed);
}

/** Return today's YYYY-MM-DD date string in IST (Asia/Kolkata). */
export function getCampusTodayDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}
