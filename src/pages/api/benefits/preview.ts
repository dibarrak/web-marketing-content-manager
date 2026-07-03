/**
 * GET /api/benefits/preview?month=Julio%202026
 * Computes the diff between the source month and the current Webflow items.
 * Admin & super-admin only. Read-only — applies nothing.
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@lib/authz';
import { BENEFITS_COLLECTION } from '@lib/config/sites';
import { getSnapshot } from '@lib/benefits/snapshots';
import { fetchAllBenefitItems } from '@lib/benefits/items';
import { computeDiff } from '@lib/benefits/sync';
import { webflowErrorResponse } from '@lib/webflow/error-response';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isAdmin(user)) return new Response('Forbidden', { status: 403 });

  const month = url.searchParams.get('month')?.trim();
  if (!month) return Response.json({ error: 'Falta el parámetro month.' }, { status: 400 });

  try {
    const env = locals.runtime.env;
    const data = await getSnapshot(env, month);
    if (!data) {
      return Response.json(
        { error: `No hay datos para "${month}". Envíalos primero desde el Apps Script.` },
        { status: 404 },
      );
    }
    const existing = await fetchAllBenefitItems(env, BENEFITS_COLLECTION.collectionId);
    const report = computeDiff(data, existing);
    return Response.json(report);
  } catch (err) {
    return webflowErrorResponse(err);
  }
};
