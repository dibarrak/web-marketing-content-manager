/**
 * GET /api/collections/:collectionId/reference-items
 *
 * Lists the items of a collection referenced by a managed collection's
 * Reference/MultiReference field, returning a lightweight `{ id, name }[]` for
 * populating the pickers.
 *
 * Access is limited to the collections registered in COLLECTION_REFERENCES and
 * gated behind access to a collection that references them — this is not a
 * generic proxy for arbitrary collections.
 */
import type { APIRoute } from 'astro';
import { getWebflow } from '@lib/webflow';
import { webflowErrorResponse } from '@lib/webflow/error-response';
import { COLLECTIONS, REFERENCE_OWNERS } from '@lib/config/sites';
import { canAccessSection } from '@lib/authz';

export const prerender = false;

export interface ReferenceOption {
  id: string;
  name: string;
}

export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const collectionId = params.collectionId!;
  const owners = REFERENCE_OWNERS.get(collectionId);
  if (!owners) return Response.json({ error: 'Unknown reference collection' }, { status: 404 });
  // Pickers are only reachable from the editor of a collection that references
  // this one, so access to any owner is enough.
  if (!owners.some((key) => canAccessSection(user, key)))
    return new Response('Forbidden', { status: 403 });

  try {
    // A referenced collection lives in the same workspace as its owner.
    const wf = getWebflow(locals.runtime.env, COLLECTIONS[owners[0]].workspace);
    // Page through so pickers show every option (Webflow caps limit at 100).
    const options: ReferenceOption[] = [];
    let offset = 0;
    for (;;) {
      const data = await wf.collections.list<{ name: string }>(collectionId, {
        limit: 100,
        offset,
      });
      for (const item of data.items) {
        options.push({ id: item.id, name: item.fieldData.name });
      }
      offset += data.items.length;
      if (data.items.length === 0 || offset >= data.pagination.total) break;
    }

    options.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return Response.json({ options });
  } catch (err) {
    return webflowErrorResponse(err);
  }
};
