/** Fetch every item of the benefits collection (paginated) as ExistingItem[]. */
import { getWebflow } from '@lib/webflow';
import { withRetry } from '@lib/merchant-sync/webflow';
import { MERCHANT_SYNC } from '@lib/config/sites';
import { listAllItems } from '@lib/merchant-sync/webflow';
import { TIENDA_BENEFIT_REF, type ExistingItem, type TiendaRef } from './sync';

export async function fetchAllBenefitItems(env: Env, collectionId: string): Promise<ExistingItem[]> {
  const wf = getWebflow(env);
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
        fieldData: it.fieldData as Record<string, unknown>,
      });
    }
    if (items.length < limit) break;
    offset += limit;
  }
  return all;
}

/** Map a raw Tiendas item to the subset the sync needs, or null without merchant-id. */
export function toTiendaRef(it: {
  id: string;
  isDraft?: boolean;
  fieldData: Record<string, unknown>;
}): TiendaRef | null {
  const merchantId = String(it.fieldData['merchant-id'] ?? '').trim();
  if (!merchantId) return null;
  return {
    id: it.id,
    merchantId,
    name: String(it.fieldData.name ?? '').trim(),
    slug: String(it.fieldData.slug ?? '').trim(),
    isDraft: it.isDraft ?? false,
    linkedBenefitId: String(it.fieldData[TIENDA_BENEFIT_REF] ?? '') || undefined,
  };
}

/** Every Tiendas landing that carries a merchant-id (paginated, 429-safe). */
export async function fetchTiendaRefs(env: Env): Promise<TiendaRef[]> {
  const items = await listAllItems(getWebflow(env), MERCHANT_SYNC.tiendasCollectionId);
  return items.map(toTiendaRef).filter((t): t is TiendaRef => t !== null);
}
