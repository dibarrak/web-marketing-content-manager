/**
 * GET /api/merchants — read-only list of merchants for pickers.
 *   ?requireLogo=false — include merchants without a logo (default true, for
 *     the coupon logo picker, which renders <img src={logoUrl}> per option).
 *     The Ad Banners merchant field only needs name + merchantId, no image.
 *
 * Unlike /api/admin/merchants (super-admin CRUD), this is available to anyone
 * who can edit a section that uses a merchant picker.
 */
import type { APIRoute } from 'astro';
import { asc } from 'drizzle-orm';
import { getDb, schema } from '@lib/db';
import { canAccessSection } from '@lib/authz';
import type { MerchantOption } from '@lib/merchants';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!canAccessSection(user, 'coupons') && !canAccessSection(user, 'adBanners'))
    return new Response('Forbidden', { status: 403 });

  const url = new URL(request.url);
  const requireLogo = url.searchParams.get('requireLogo') !== 'false';

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

  const merchants: MerchantOption[] = requireLogo ? rows.filter((m) => m.logoUrl) : rows;
  return Response.json({ merchants });
};
