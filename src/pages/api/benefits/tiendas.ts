/**
 * GET /api/benefits/tiendas?offset=0
 * One slice of the Tiendas collection (a few Webflow pages) as TiendaRef[].
 * The collection has thousands of items, so listing it in a single request
 * blows through the gateway timeout; the UI walks it slice by slice following
 * `next` and hands the result to the preview. Admin & super-admin only.
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@lib/authz';
import { MERCHANT_SYNC } from '@lib/config/sites';
import { getWebflow, WebflowApiError } from '@lib/webflow';
import { toTiendaRef } from '@lib/benefits/items';
import { withRetry } from '@lib/merchant-sync/webflow';
import type { TiendaRef } from '@lib/benefits/sync';
import { webflowErrorResponse } from '@lib/webflow/error-response';

export const prerender = false;

const PAGE_SIZE = 100;
const PAGES_PER_REQUEST = 4;
/** Webflow Cloud cuts requests at ~20s: don't sleep through long 429 windows. */
const SHORT_RETRY = { maxWaitSeconds: 4 };

export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isAdmin(user)) return new Response('Forbidden', { status: 403 });

  let offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  const wf = getWebflow(locals.runtime.env);
  const tiendas: TiendaRef[] = [];
  let total = 0;
  let next: number | null = null;

  try {
    for (let p = 0; p < PAGES_PER_REQUEST; p++) {
      const page = await withRetry(
        () => wf.collections.list(MERCHANT_SYNC.tiendasCollectionId, { limit: PAGE_SIZE, offset }),
        SHORT_RETRY,
      );
      const items = page.items ?? [];
      total = page.pagination?.total ?? total;
      for (const it of items) {
        const ref = toTiendaRef({ id: it.id, isDraft: it.isDraft, fieldData: it.fieldData });
        if (ref) tiendas.push(ref);
      }
      offset += PAGE_SIZE;
      if (items.length < PAGE_SIZE || offset >= total) {
        next = null;
        break;
      }
      next = offset;
    }
    return Response.json({ tiendas, next, total });
  } catch (err) {
    // Rate-limited mid-slice: return what we have and let the UI resume after the wait.
    if (err instanceof WebflowApiError && err.status === 429) {
      return Response.json({
        tiendas,
        next: offset,
        total,
        retryAfter: err.retryAfterSeconds ?? 10,
      });
    }
    return webflowErrorResponse(err);
  }
};
