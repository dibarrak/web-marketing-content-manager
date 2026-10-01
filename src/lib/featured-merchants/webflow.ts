/**
 * Webflow I/O helpers for the featured-merchants preview/apply routes —
 * the generic item listing / retry helpers are shared with Longtail Sliders.
 */
import type { ExistingItem } from './sync';
import { listAllItems, byMerchantId, withRetry } from '@lib/longtail-sliders/webflow';

export { listAllItems, byMerchantId, withRetry };

/** Index Categories items by their Webflow `slug`. */
export function bySlug(items: ExistingItem[]): Map<string, ExistingItem> {
  const map = new Map<string, ExistingItem>();
  for (const it of items) {
    const slug = String(it.fieldData.slug ?? '').trim();
    if (slug && !map.has(slug)) map.set(slug, it);
  }
  return map;
}
