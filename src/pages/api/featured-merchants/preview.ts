/**
 * POST /api/featured-merchants/preview   body: { rows: string[][] }
 *
 * Computes the diff between the uploaded CSV and the current Webflow state
 * (Comercios destacados por categoría + Merchants, for the reference lookup). Admin &
 * super-admin only. Read-only — applies nothing.
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@lib/authz';
import { FEATURED_MERCHANTS_SYNC } from '@lib/config/sites';
import { getWebflow } from '@lib/webflow';
import { computeFeaturedDiff } from '@lib/featured-merchants/sync';
import { listAllItems, byMerchantId, bySlug } from '@lib/featured-merchants/webflow';
import { webflowErrorResponse } from '@lib/webflow/error-response';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isAdmin(user)) return new Response('Forbidden', { status: 403 });

  const body = (await request.json().catch(() => null)) as { rows?: unknown } | null;
  const rows = Array.isArray(body?.rows) ? (body!.rows as string[][]) : null;
  if (!rows) return Response.json({ error: 'Falta rows.' }, { status: 400 });

  try {
    const { collectionId, merchantsCollectionId, categoryCollectionId, merchantIdFieldSlug, workspace } =
      FEATURED_MERCHANTS_SYNC;
    const wf = getWebflow(locals.runtime.env, workspace);

    const [existingItems, merchantItems, categoryItems] = await Promise.all([
      listAllItems(wf, collectionId),
      listAllItems(wf, merchantsCollectionId),
      listAllItems(wf, categoryCollectionId),
    ]);

    const report = computeFeaturedDiff(
      rows,
      existingItems,
      byMerchantId(merchantItems, merchantIdFieldSlug),
      bySlug(categoryItems),
    );
    return Response.json(report);
  } catch (err) {
    return webflowErrorResponse(err);
  }
};
