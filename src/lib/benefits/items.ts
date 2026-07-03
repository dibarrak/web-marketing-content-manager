/** Fetch every item of the benefits collection (paginated) as ExistingItem[]. */
import { getWebflow } from '@lib/webflow';
import type { ExistingItem } from './sync';

export async function fetchAllBenefitItems(env: Env, collectionId: string): Promise<ExistingItem[]> {
  const wf = getWebflow(env);
  const all: ExistingItem[] = [];
  const limit = 100;
  let offset = 0;
  for (;;) {
    const page = await wf.collections.list(collectionId, { limit, offset });
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
