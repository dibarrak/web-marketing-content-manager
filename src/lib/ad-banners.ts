/**
 * Helpers for the "Automatized Ad Banners" CMS collection.
 *
 * `site-target` is a PlainText field that the `Ad Banner` code component reads
 * as: one destination, several separated by commas, or `all`. The form edits it
 * as a checkbox group, so these helpers convert between both representations.
 */

/** Destinations the Ad Banner component understands (see its `SiteTarget` type). */
export const AD_BANNER_SITES = [
  'Home',
  'Promociones',
  'Registrate hoy',
  'Amazon',
  'Prototype',
  'Longtail',
] as const;

/** Special value: the banner shows on every destination. */
export const AD_BANNER_ALL = 'all';

const SEPARATOR = /[,;|]/;

const canonical = (value: string): string | undefined =>
  AD_BANNER_SITES.find((s) => s.toLowerCase() === value.trim().toLowerCase());

/**
 * Parses the stored string into the selected destinations, in canonical casing
 * and canonical order. `all` collapses everything else. Unknown tokens are kept
 * out of the result (the schema rejects them on save).
 */
export function parseSiteTarget(raw: string | null | undefined): string[] {
  const tokens = (raw ?? '')
    .split(SEPARATOR)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.some((t) => t === AD_BANNER_ALL || t === '*')) return [AD_BANNER_ALL];
  const picked = new Set(tokens.map(canonical).filter((s): s is NonNullable<typeof s> => !!s));
  return AD_BANNER_SITES.filter((s) => picked.has(s));
}

/** Inverse of {@link parseSiteTarget}: `all`, or the destinations joined by `, `. */
export function serializeSiteTarget(sites: readonly string[]): string {
  if (sites.includes(AD_BANNER_ALL)) return AD_BANNER_ALL;
  return AD_BANNER_SITES.filter((s) => sites.includes(s)).join(', ');
}

/** True when every token is a known destination (or the value is `all`). */
export function isValidSiteTarget(raw: string | null | undefined): boolean {
  const tokens = (raw ?? '')
    .split(SEPARATOR)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => t === AD_BANNER_ALL || t === '*' || canonical(t) !== undefined);
}

/** Whether a banner stored with `raw` shows on `site` (used by the list filter). */
export function matchesSiteTarget(raw: string | null | undefined, site: string): boolean {
  if (!site) return true;
  const parsed = parseSiteTarget(raw);
  return parsed.includes(AD_BANNER_ALL) || parsed.includes(canonical(site) ?? site);
}

/**
 * TipTap wraps a single line in `<p>…</p>`. The component renders the title
 * inline, so drop that one wrapper — but leave multi-paragraph HTML alone.
 */
export function unwrapSingleParagraph(html: string | null | undefined): string {
  const value = (html ?? '').trim();
  const m = /^<p>([\s\S]*)<\/p>$/.exec(value);
  return m && !m[1].includes('</p>') ? m[1] : value;
}
