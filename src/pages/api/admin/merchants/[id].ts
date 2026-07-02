/**
 * PATCH  /api/admin/merchants/:id  — update a merchant (super-admin only)
 *                                    body: { merchantId, name, logoUrl, logoAssetId? }
 * DELETE /api/admin/merchants/:id  — remove a merchant (super-admin only)
 *
 * Deleting a merchant does NOT touch coupons that already reference its logo:
 * those store an immutable {url, alt} snapshot. The Webflow asset is left in
 * place (assets are shared and never auto-deleted).
 */
import type { APIRoute } from 'astro';
import { and, eq, ne } from 'drizzle-orm';
import { getDb, schema } from '@lib/db';
import { isSuperAdmin } from '@lib/authz';
import { logAudit } from '@lib/audit';
import { DEFAULT_SITE_ID } from '@lib/config/sites';
import { MERCHANTS_AUDIT_COLLECTION, merchantInputSchema } from '@lib/merchants';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isSuperAdmin(user)) return new Response('Forbidden', { status: 403 });

  const id = params.id!;
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

  const [target] = await db
    .select({ id: schema.merchants.id })
    .from(schema.merchants)
    .where(eq(schema.merchants.id, id));
  if (!target) return Response.json({ error: 'Comercio no encontrado.' }, { status: 404 });

  // Uniqueness: no OTHER merchant may share this merchantId.
  const [clash] = await db
    .select({ id: schema.merchants.id })
    .from(schema.merchants)
    .where(and(eq(schema.merchants.merchantId, merchantId), ne(schema.merchants.id, id)));
  if (clash) {
    return Response.json({ error: 'Ya existe un comercio con ese ID.' }, { status: 409 });
  }

  await db
    .update(schema.merchants)
    .set({ merchantId, name, logoUrl, logoAssetId: logoAssetId ?? null, updatedAt: new Date() })
    .where(eq(schema.merchants.id, id));

  await logAudit(env, {
    userId: user.id,
    userEmail: user.email,
    action: 'update',
    siteId: DEFAULT_SITE_ID,
    collectionId: MERCHANTS_AUDIT_COLLECTION,
    itemId: id,
    itemSlug: merchantId,
    diff: { after: { merchantId, name, logoUrl } },
  });

  return Response.json({ ok: true });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isSuperAdmin(user)) return new Response('Forbidden', { status: 403 });

  const id = params.id!;
  const env = locals.runtime.env;
  const db = getDb(env);

  const [target] = await db
    .select({ id: schema.merchants.id, merchantId: schema.merchants.merchantId })
    .from(schema.merchants)
    .where(eq(schema.merchants.id, id));
  if (!target) return Response.json({ error: 'Comercio no encontrado.' }, { status: 404 });

  await db.delete(schema.merchants).where(eq(schema.merchants.id, id));

  await logAudit(env, {
    userId: user.id,
    userEmail: user.email,
    action: 'delete',
    siteId: DEFAULT_SITE_ID,
    collectionId: MERCHANTS_AUDIT_COLLECTION,
    itemId: id,
    itemSlug: target.merchantId,
  });

  return new Response(null, { status: 204 });
};
