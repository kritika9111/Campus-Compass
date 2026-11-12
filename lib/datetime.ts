/** Format a date for a datetime-local input using the browser's local timezone. */
export function toLocalDateTimeInputValue(date: Date): string {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}
