/**
 * POST /api/longtail-sliders/apply   body: { rows: string[][] }
 *
 * Re-computes the diff server-side (never trusts a client-calculated diff)
 * and fully replaces the collection:
 *   1. every existing item is unpublished + deleted (two bulk calls per 100
 *      items, same contract as the generic bulk-delete route);
 *   2. every 'ready' row from the CSV is created and published immediately
 *      (`/items/live`) — confirmed with stakeholder: this sync publishes
 *      straight to the live site, no separate "Publish site" step.
 * Rows in 'error' status are skipped — never created without their
 * Merchant/Option reference resolved. The whole operation happens in this
 * order (delete before create) because the collection must be empty before
 * the new rows land, per the sync's own requirement.
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@lib/authz';
import { LONGTAIL_SLIDERS_SYNC } from '@lib/config/sites';
import { getWebflow, WebflowApiError } from '@lib/webflow';
import { BULK_ITEM_LIMIT } from '@lib/webflow/collections';
import { computeLongtailDiff } from '@lib/longtail-sliders/sync';
import { listAllItems, byMerchantId, withRetry } from '@lib/longtail-sliders/webflow';
import { logAudit } from '@lib/audit';
import { webflowErrorResponse } from '@lib/webflow/error-response';

export const prerender = false;

interface CreateResult {
  row: number;
  merchantId: string;
  slug: string;
  ok: boolean;
  error?: string;
}

interface DeleteFailure {
  ids: string[];
  error: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function errorMessage(err: unknown): string {
  if (err instanceof WebflowApiError) {
    if (err.status === 429) return 'Rate limit de Webflow; reintenta en un momento.';
    // A collection that has never been included in a site publish has no
    // "live" counterpart yet, so /items/live 404s on every single item —
    // confirmed against Webflow's API (not a data problem with this row).
    if (err.code === 'resource_not_found') {
      return 'La colección "Longtail Sliders" nunca se ha publicado en el sitio — Webflow no puede crear items "en vivo" hasta el primer publish. Publica el sitio (botón inferior derecho) y vuelve a sincronizar.';
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Error desconocido.';
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isAdmin(user)) return new Response('Forbidden', { status: 403 });

  const body = (await request.json().catch(() => null)) as { rows?: unknown } | null;
  const rows = Array.isArray(body?.rows) ? (body!.rows as string[][]) : null;
  if (!rows) return Response.json({ error: 'Falta rows.' }, { status: 400 });

  const env = locals.runtime.env;
  const { collectionId, merchantsCollectionId, merchantIdFieldSlug, siteId, workspace } =
    LONGTAIL_SLIDERS_SYNC;
  const wf = getWebflow(env, workspace);

  let report;
  let existingItems;
  try {
    const [existing, merchantItems] = await Promise.all([
      listAllItems(wf, collectionId),
      listAllItems(wf, merchantsCollectionId),
    ]);
    existingItems = existing;
    report = computeLongtailDiff(rows, existing, byMerchantId(merchantItems, merchantIdFieldSlug));
    if (report.headerError) {
      return Response.json({ error: report.headerError }, { status: 400 });
    }
  } catch (err) {
    return webflowErrorResponse(err);
  }

  // ---- 1. wipe every existing item, unconditionally ----
  const existingIds = existingItems.map((it) => it.id);
  const publishedIds = existingItems.filter((it) => !it.isDraft && it.lastPublished).map((it) => it.id);

  const deleteFailures: DeleteFailure[] = [];
  for (const batch of chunk(publishedIds, BULK_ITEM_LIMIT)) {
    try {
      await withRetry(() => wf.collections.unpublishMany(collectionId, batch));
    } catch (err) {
      deleteFailures.push({ ids: batch, error: errorMessage(err) });
    }
  }
  const deleted: string[] = [];
  for (const batch of chunk(existingIds, BULK_ITEM_LIMIT)) {
    try {
      await withRetry(() => wf.collections.removeMany(collectionId, batch));
      deleted.push(...batch);
    } catch (err) {
      deleteFailures.push({ ids: batch, error: errorMessage(err) });
    }
  }
  for (const it of existingItems) {
    if (!deleted.includes(it.id)) continue;
    await logAudit(env, {
      userId: user.id,
      userEmail: user.email,
      action: 'delete',
      siteId,
      collectionId,
      itemId: it.id,
      itemSlug: String(it.fieldData.slug ?? ''),
      diff: { source: 'longtail-sliders-sync', before: it.fieldData, bulk: true },
    });
  }

  // ---- 2. create every valid row, published live ----
  const results: CreateResult[] = [];
  for (const r of report.rows) {
    if (r.status !== 'ready') continue;
    try {
      const created = await withRetry(() =>
        wf.collections.create(collectionId, r.fieldData as { name: string; slug: string }, {
          publish: true,
        }),
      );
      await logAudit(env, {
        userId: user.id,
        userEmail: user.email,
        action: 'create',
        siteId,
        collectionId,
        itemId: created.id,
        itemSlug: r.slug,
        diff: { source: 'longtail-sliders-sync', fieldData: r.fieldData },
      });
      results.push({ row: r.row, merchantId: r.merchantId, slug: r.slug, ok: true });
    } catch (err) {
      results.push({ row: r.row, merchantId: r.merchantId, slug: r.slug, ok: false, error: errorMessage(err) });
    }
  }

  const created = results.filter((r) => r.ok).length;
  const createFailed = results.length - created;
  return Response.json({
    deletedCount: deleted.length,
    skippedRows: report.counts.error,
    created,
    createFailed,
    results,
    ...(deleteFailures.length > 0 ? { deleteFailures } : {}),
  });
};
