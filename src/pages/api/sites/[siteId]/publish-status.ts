/**
 * GET /api/sites/:siteId/publish-status
 *
 * Last time this site was actually published to staging / production,
 * derived from our own audit log (the only publish path this app exposes —
 * see /api/sites/:siteId/publish). Used to tell "this item is live in the
 * Webflow CMS" apart from "the site has been republished since this item's
 * last change", which are not the same thing.
 *
 * Caveat: a publish triggered directly from the Webflow Designer/dashboard
 * (outside this app) is invisible to us — the timestamps below can lag behind
 * reality in that case.
 */
import type { APIRoute } from 'astro';
import { and, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@lib/db';
import { isKnownSiteId } from '@lib/config/sites';

export const prerender = false;

export interface SitePublishStatus {
  stagingPublishedAt: string | null;
  productionPublishedAt: string | null;
}

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });

  const siteId = params.siteId!;
  if (!isKnownSiteId(siteId)) return Response.json({ error: 'Unknown site' }, { status: 404 });

  const db = getDb(locals.runtime.env);
  const rows = await db
    .select({ ts: schema.auditLog.ts, diffJson: schema.auditLog.diffJson })
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.siteId, siteId), eq(schema.auditLog.action, 'publish')))
    .orderBy(desc(schema.auditLog.ts))
    .limit(200);

  const result: SitePublishStatus = { stagingPublishedAt: null, productionPublishedAt: null };
  for (const row of rows) {
    if (result.stagingPublishedAt && result.productionPublishedAt) break;
    let target: string | undefined;
    try {
      target = row.diffJson ? (JSON.parse(row.diffJson) as { target?: string }).target : undefined;
    } catch {
      continue;
    }
    if (target === 'staging' && !result.stagingPublishedAt) {
      result.stagingPublishedAt = row.ts.toISOString();
    } else if (target === 'production' && !result.productionPublishedAt) {
      result.productionPublishedAt = row.ts.toISOString();
    }
  }

  return Response.json(result);
};
