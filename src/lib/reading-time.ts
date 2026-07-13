/**
 * Estimate reading time (in whole minutes) from rich-text HTML.
 * Strips tags, counts words, and divides by an average reading speed. Always
 * returns at least 1 minute for non-empty content.
 */
const WORDS_PER_MINUTE = 200;

export function readingTimeMinutes(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .trim();
  if (!text) return 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
