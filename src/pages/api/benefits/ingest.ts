/**
 * POST /api/benefits/ingest
 * Receives a promo snapshot pushed by the Apps Script extractor and stores it.
 * No user session — authenticated with a shared secret (BENEFITS_INGEST_SECRET)
 * sent in the `Authorization: Bearer <secret>` header. Exempted from the
 * session middleware; the secret is the only gate.
 *
 * Body: { month: string, cashback: [...], cupon: [...], pushedBy?: string }
 */
import type { APIRoute } from 'astro';
import { saveSnapshot } from '@lib/benefits/snapshots';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const expected = env.BENEFITS_INGEST_SECRET;
  if (!expected) return Response.json({ error: 'Ingesta no configurada.' }, { status: 503 });

  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== expected) return new Response('Unauthorized', { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    month?: string;
    cashback?: unknown;
    cupon?: unknown;
    pushedBy?: string;
  } | null;

  const month = body?.month?.trim();
  if (!month) return Response.json({ error: 'Falta month.' }, { status: 400 });
  if (!Array.isArray(body?.cashback) && !Array.isArray(body?.cupon)) {
    return Response.json({ error: 'Se esperaban arreglos cashback y/o cupon.' }, { status: 400 });
  }

  try {
    await saveSnapshot(
      env,
      month,
      {
        cashback: Array.isArray(body!.cashback) ? (body!.cashback as never) : [],
        cupon: Array.isArray(body!.cupon) ? (body!.cupon as never) : [],
      },
      typeof body!.pushedBy === 'string' ? body!.pushedBy : null,
    );
    const counts = {
      cashback: Array.isArray(body!.cashback) ? body!.cashback.length : 0,
      cupon: Array.isArray(body!.cupon) ? body!.cupon.length : 0,
    };
    return Response.json({ ok: true, month, counts });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Error guardando el snapshot.' },
      { status: 500 },
    );
  }
};
