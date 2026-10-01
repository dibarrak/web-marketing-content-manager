/**
 * POST /api/benefits/preview  body: { month: string, tiendas: TiendaRef[] }
 * Computes the diff between the source month and the current Webflow items.
 * `tiendas` is the landing index the UI collected from /api/benefits/tiendas
 * (too big to list here without timing out). It is only used to decide which
 * missing merchants can be created; /apply re-verifies every Tienda it links.
 * Admin & super-admin only. Read-only — applies nothing.
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@lib/authz';
import { BENEFITS_COLLECTION } from '@lib/config/sites';
import { getSnapshot } from '@lib/benefits/snapshots';
import { fetchAllBenefitItems } from '@lib/benefits/items';
import { computeDiff, type TiendaRef } from '@lib/benefits/sync';
import { webflowErrorResponse } from '@lib/webflow/error-response';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isAdmin(user)) return new Response('Forbidden', { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    month?: string;
    tiendas?: Array<Partial<TiendaRef>>;
  } | null;
  const month = body?.month?.trim();
  if (!month) return Response.json({ error: 'Falta month.' }, { status: 400 });
  const tiendas: TiendaRef[] = (Array.isArray(body?.tiendas) ? body!.tiendas : [])
    .filter((t) => typeof t?.id === 'string' && typeof t?.merchantId === 'string')
    .map((t) => ({
      id: t.id!,
      merchantId: t.merchantId!,
      name: String(t.name ?? ''),
      slug: String(t.slug ?? ''),
      isDraft: t.isDraft === true,
      linkedBenefitId: typeof t.linkedBenefitId === 'string' ? t.linkedBenefitId : undefined,
    }));

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
    const report = computeDiff(data, existing, tiendas);
    return Response.json(report);
  } catch (err) {
    return webflowErrorResponse(err);
  }
};
