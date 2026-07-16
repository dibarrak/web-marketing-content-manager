/**
 * Conversions between ISO 8601 UTC strings and the local-time string a
 * `datetime-local` input needs — fixed to Mexico City time
 * (`America/Mexico_City`), NOT the browser's own timezone.
 *
 * These schedules are always authored and interpreted as Mexico time
 * regardless of where the person editing is physically located or how their
 * OS clock is configured, so we can't use the browser's local `Date` getters
 * the way a plain `datetime-local` field normally would — that would show a
 * different wall-clock time to someone editing from outside Mexico.
 */

const MX_TIMEZONE = 'America/Mexico_City';

const mxFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MX_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function mxParts(date: Date): Record<string, string> {
  return Object.fromEntries(mxFormatter.formatToParts(date).map((p) => [p.type, p.value]));
}

/** ISO 8601 UTC string → `datetime-local` value, shown as Mexico City time. */
export function isoToMxDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = mxParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

/**
 * `datetime-local` value, interpreted as Mexico City wall-clock time → ISO
 * 8601 UTC string. `Intl` has no direct "parse this local time in this IANA
 * zone" API, so this uses the standard probe-and-correct round trip: treat
 * the string as a UTC instant, see how that instant renders in Mexico time,
 * and shift by the difference to land on the instant that actually renders
 * as the requested wall-clock time in Mexico.
 */
export function mxDatetimeLocalToIso(local: string): string {
  if (!local) return '';
  const probe = new Date(`${local}Z`);
  if (Number.isNaN(probe.getTime())) return '';
  const p = mxParts(probe);
  const probeInMxAsUtc = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
  const correctionMs = probe.getTime() - probeInMxAsUtc.getTime();
  const result = new Date(probe.getTime() + correctionMs);
  // Match the source format exactly (no milliseconds) — `datetime-local`
  // inputs only carry second precision anyway, so `.000` is never meaningful.
  return result.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
