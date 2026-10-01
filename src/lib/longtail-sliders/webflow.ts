/**
 * Webflow I/O helpers shared by the longtail-sliders preview/apply routes.
 */
import { WebflowApiError, type getWebflow } from '@lib/webflow';
import type { ExistingItem } from './sync';

const MAX_RETRIES = 5;
const DEFAULT_RETRY_SECONDS = 3;
const MAX_RETRY_SECONDS = 30;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries a Webflow call on a 429, waiting the amount of time Webflow asked
 * for (Retry-After) instead of failing immediately — see the identical
 * rationale in `@lib/merchant-sync/webflow`. */
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

/** Index Merchants items by their `merchant-id` PlainText field. */
export function byMerchantId(
  items: ExistingItem[],
  merchantIdFieldSlug: string,
): Map<string, ExistingItem> {
  const map = new Map<string, ExistingItem>();
  for (const it of items) {
    const id = String(it.fieldData[merchantIdFieldSlug] ?? '').trim();
    if (id && !map.has(id)) map.set(id, it);
  }
  return map;
}
