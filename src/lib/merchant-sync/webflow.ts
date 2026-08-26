/**
 * Webflow I/O helpers shared by the merchant-sync preview/apply routes.
 */
import { WebflowApiError, type getWebflow } from '@lib/webflow';
import { F, type ExistingItem, type SlugOption } from './sync';

const MAX_RETRIES = 5;
const DEFAULT_RETRY_SECONDS = 3;
const MAX_RETRY_SECONDS = 30;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a Webflow call on a 429, waiting the amount of time Webflow asked
 * for (Retry-After) instead of failing immediately.
 *
 * A batch with many Baja rows can easily burn through Webflow's per-minute
 * quota — each cascade delete costs up to 5 API calls (unpublish + remove on
 * Tiendas, then get + unpublish + remove on the Merchant). Without this,
 * every call made during the resulting penalty window fails instantly, and
 * a whole block of consecutive rows silently drops (confirmed in production:
 * a batch of ~84 rows lost the ~50 rows made during a ~16s rate-limit
 * window, recovering once it reset).
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof WebflowApiError) || err.status !== 429 || attempt >= MAX_RETRIES) {
        throw err;
      }
      const waitSeconds = Math.min(
        err.retryAfterSeconds ?? DEFAULT_RETRY_SECONDS,
        MAX_RETRY_SECONDS,
      );
      await sleep(waitSeconds * 1000);
    }
  }
}

export async function listAllItems(
  wf: ReturnType<typeof getWebflow>,
  collectionId: string,
): Promise<ExistingItem[]> {
  const all: ExistingItem[] = [];
  const limit = 100;
  let offset = 0;
  for (;;) {
    const page = await withRetry(() => wf.collections.list(collectionId, { limit, offset }));
    const items = page.items ?? [];
    for (const it of items) {
      all.push({
        id: it.id,
        isDraft: it.isDraft ?? false,
        lastPublished: it.lastPublished ?? null,
        fieldData: it.fieldData as Record<string, unknown>,
      });
    }
    if (items.length < limit) break;
    offset += limit;
  }
  return all;
}

export function bySlug(items: ExistingItem[]): Map<string, SlugOption> {
  const map = new Map<string, SlugOption>();
  for (const it of items) {
    const slug = String(it.fieldData.slug ?? '').toLowerCase();
    if (slug) map.set(slug, { id: it.id, name: String(it.fieldData.name ?? slug) });
  }
  return map;
}

export function byMerchantId(items: ExistingItem[]): Map<string, ExistingItem> {
  const map = new Map<string, ExistingItem>();
  for (const it of items) {
    const id = String(it.fieldData[F.merchantId] ?? '').trim();
    if (id && !map.has(id)) map.set(id, it);
  }
  return map;
}

export function tiendasByMerchantId(items: ExistingItem[]): Map<string, ExistingItem[]> {
  const map = new Map<string, ExistingItem[]>();
  for (const it of items) {
    const id = String(it.fieldData[F.merchantId] ?? '').trim();
    if (!id) continue;
    const list = map.get(id) ?? [];
    list.push(it);
    map.set(id, list);
  }
  return map;
}
