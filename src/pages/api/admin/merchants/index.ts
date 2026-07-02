/**
 * GET  /api/admin/merchants  — list all merchants (super-admin only)
 * POST /api/admin/merchants  — create a merchant (super-admin only)
 *                              body: { merchantId, name, logoUrl, logoAssetId? }
 */
import type { APIRoute } from 'astro';
import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from '@lib/db';
import { isSuperAdmin } from '@lib/authz';
import { logAudit } from '@lib/audit';
import { DEFAULT_SITE_ID } from '@lib/config/sites';
import { MERCHANTS_AUDIT_COLLECTION, merchantInputSchema } from '@lib/merchants';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (!isSuperAdmin(locals.user)) return new Response('Forbidden', { status: 403 });

  const db = getDb(locals.runtime.env);
  const merchants = await db
    .select()
    .from(schema.merchants)
    .orderBy(asc(schema.merchants.name));

  return Response.json({ merchants });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isSuperAdmin(user)) return new Response('Forbidden', { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = merchantInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 },
    );
  }
  const { merchantId, name, logoUrl, logoAssetId } = parsed.data;

  const env = locals.runtime.env;
  const db = getDb(env);

  const [existing] = await db
    .select({ id: schema.merchants.id })
    .from(schema.merchants)
    .where(eq(schema.merchants.merchantId, merchantId));
  if (existing) {
    return Response.json({ error: 'Ya existe un comercio con ese ID.' }, { status: 409 });
  }

  const now = new Date();
  const id = crypto.randomUUID();
  await db.insert(schema.merchants).values({
    id,
    merchantId,
    name,
    logoUrl,
    logoAssetId: logoAssetId ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await logAudit(env, {
    userId: user.id,
    userEmail: user.email,
    action: 'create',
    siteId: DEFAULT_SITE_ID,
    collectionId: MERCHANTS_AUDIT_COLLECTION,
    itemId: id,
    itemSlug: merchantId,
    diff: { after: { merchantId, name, logoUrl } },
  });

  return Response.json({ id }, { status: 201 });
};
