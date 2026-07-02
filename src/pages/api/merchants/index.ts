/**
 * GET /api/merchants — read-only list of merchants for the coupon picker.
 *
 * Unlike /api/admin/merchants (super-admin CRUD), this is available to anyone
 * who can edit the coupons collection, since the picker lives in the coupon
 * form. Returns only merchants that have a logo.
 */
import type { APIRoute } from 'astro';
import { asc } from 'drizzle-orm';
import { getDb, schema } from '@lib/db';
import { canAccessCollection } from '@lib/authz';
import { COLLECTIONS } from '@lib/config/sites';
import type { MerchantOption } from '@lib/merchants';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!canAccessCollection(user, COLLECTIONS.coupons.collectionId))
    return new Response('Forbidden', { status: 403 });

  const db = getDb(locals.runtime.env);
  const rows = await db
    .select({
      id: schema.merchants.id,
      merchantId: schema.merchants.merchantId,
      name: schema.merchants.name,
      logoUrl: schema.merchants.logoUrl,
    })
    .from(schema.merchants)
    .orderBy(asc(schema.merchants.name));

  const merchants: MerchantOption[] = rows.filter((m) => m.logoUrl);
  return Response.json({ merchants });
};
