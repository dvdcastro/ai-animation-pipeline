/**
 * Simple timestamped logger for pipeline progress output.
 * Writes to stdout only so output can be piped.
 * @module logger
 */

/**
 * Formats a Date as HH:MM:SS.
 * @param date - The date to format.
 * @returns Formatted time string.
 */
function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Logs a timestamped pipeline step message to stdout.
 * Format: `[HH:MM:SS] [step] message`
 *
 * @param step - The pipeline step name (e.g. "normalize", "atlas").
 * @param message - The human-readable message to display.
 */
export function log(step: string, message: string): void {
  const time = formatTime(new Date());
  process.stdout.write(`[${time}] [${step}] ${message}\n`);
}

/**
 * Returns the current high-resolution timestamp in milliseconds.
 * Use with {@link elapsed} to measure step durations.
 *
 * @returns Current time from `performance.now()`.
 */
export function now(): number {
  return performance.now();
}

/**
 * Calculates elapsed time in seconds since a start timestamp.
 *
 * @param start - Start timestamp from {@link now}.
 * @returns Elapsed time rounded to one decimal place (e.g. `1.2`).
 */
export function elapsed(start: number): string {
  return ((performance.now() - start) / 1000).toFixed(1);
}
