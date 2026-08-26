/**
 * POST /api/merchant-sync/preview   body: { rows: string[][] }
 *
 * Computes the diff between the uploaded CSV rows and the current Webflow
 * state (Merchants + Tiendas). Admin & super-admin only. Read-only — applies
 * nothing.
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@lib/authz';
import { MERCHANT_SYNC } from '@lib/config/sites';
import { getWebflow } from '@lib/webflow';
import { computeMerchantDiff } from '@lib/merchant-sync/sync';
import { listAllItems, bySlug, byMerchantId, tiendasByMerchantId } from '@lib/merchant-sync/webflow';
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
    const env = locals.runtime.env;
    const wf = getWebflow(env, MERCHANT_SYNC.workspace);

    const [categoryItems, channelItems, merchantItems, tiendaItems] = await Promise.all([
      listAllItems(wf, MERCHANT_SYNC.categoryCollectionId),
      listAllItems(wf, MERCHANT_SYNC.channelCollectionId),
      listAllItems(wf, MERCHANT_SYNC.merchantsCollectionId),
      listAllItems(wf, MERCHANT_SYNC.tiendasCollectionId),
    ]);

    const report = computeMerchantDiff(
      rows,
      byMerchantId(merchantItems),
      tiendasByMerchantId(tiendaItems),
      bySlug(categoryItems),
      bySlug(channelItems),
    );
    return Response.json(report);
  } catch (err) {
    return webflowErrorResponse(err);
  }
};
