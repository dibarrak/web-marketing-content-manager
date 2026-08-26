/**
 * POST /api/merchant-sync/apply   body: { rows: string[][], merchantIds: string[] }
 *
 * Re-computes the diff server-side (never trusts a client-calculated diff)
 * and applies only the selected, actionable rows. Creates/updates are written
 * to the STAGED endpoint (not published) — publishing is a separate manual
 * step via PublishControls, same contract as Benefits sync.
 *
 * Deletes are a two-step cascade: the "Tiendas" landing page(s) referencing
 * the merchant must be removed before the Merchant item itself, or Webflow
 * refuses the delete. If the Tiendas removal fails, the Merchant is left
 * alone rather than deleting it and orphaning nothing — that row is reported
 * as failed instead.
 *
 * Every Webflow call goes through `withRetry` (see `@lib/merchant-sync/webflow`):
 * a batch with many Baja rows can burn through Webflow's per-minute rate
 * limit (each cascade delete costs up to 5 calls), and without a retry a
 * whole block of rows made during the resulting 429 window would silently
 * fail instead of just waiting it out.
 *
 * Rows execute grouped by action (create, then update, then delete) rather
 * than CSV order, so the cheap 1-call rows land before the expensive cascade
 * deletes exhaust the rate limit. Purely an execution-order detail — every
 * requested merchantId is still processed exactly once.
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@lib/authz';
import { MERCHANT_SYNC } from '@lib/config/sites';
import { getWebflow, WebflowApiError } from '@lib/webflow';
import { computeMerchantDiff, type ExistingItem, type MerchantEntry } from '@lib/merchant-sync/sync';
import { listAllItems, bySlug, byMerchantId, tiendasByMerchantId, withRetry } from '@lib/merchant-sync/webflow';
import { logAudit } from '@lib/audit';
import { webflowErrorResponse } from '@lib/webflow/error-response';

export const prerender = false;

interface ApplyResult {
  merchantId: string;
  name: string;
  action: 'create' | 'update' | 'delete';
  ok: boolean;
  error?: string;
}

function errorMessage(err: unknown): string {
  if (err instanceof WebflowApiError) {
    return err.status === 429 ? 'Rate limit de Webflow; reintenta en un momento.' : err.message;
  }
  return err instanceof Error ? err.message : 'Error desconocido.';
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isAdmin(user)) return new Response('Forbidden', { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    rows?: unknown;
    merchantIds?: unknown;
  } | null;
  const rows = Array.isArray(body?.rows) ? (body!.rows as string[][]) : null;
  const merchantIds = Array.isArray(body?.merchantIds) ? (body!.merchantIds as string[]) : [];
  if (!rows) return Response.json({ error: 'Falta rows.' }, { status: 400 });
  if (merchantIds.length === 0) {
    return Response.json({ error: 'No se seleccionaron merchants.' }, { status: 400 });
  }

  const env = locals.runtime.env;
  const { merchantsCollectionId, tiendasCollectionId, siteId, workspace } = MERCHANT_SYNC;
  const wf = getWebflow(env, workspace);

  let entriesById: Map<string, MerchantEntry>;
  let existingTiendas: Map<string, ExistingItem[]>;
  try {
    const [categoryItems, channelItems, merchantItems, tiendaItems] = await Promise.all([
      listAllItems(wf, MERCHANT_SYNC.categoryCollectionId),
      listAllItems(wf, MERCHANT_SYNC.channelCollectionId),
      listAllItems(wf, merchantsCollectionId),
      listAllItems(wf, tiendasCollectionId),
    ]);
    existingTiendas = tiendasByMerchantId(tiendaItems);
    const report = computeMerchantDiff(
      rows,
      byMerchantId(merchantItems),
      existingTiendas,
      bySlug(categoryItems),
      bySlug(channelItems),
    );
    if (report.headerError) {
      return Response.json({ error: report.headerError }, { status: 400 });
    }
    entriesById = new Map(report.entries.map((e) => [e.merchantId, e]));
  } catch (err) {
    return webflowErrorResponse(err);
  }

  const tiendaById = new Map<string, ExistingItem>();
  for (const list of existingTiendas.values()) {
    for (const t of list) tiendaById.set(t.id, t);
  }

  // Process cheap rows (1 Webflow call) before expensive cascade deletes (up
  // to 5 calls each) — a CSV with many consecutive Baja rows would otherwise
  // front-load the priciest calls and hit the rate limit before touching any
  // Alta/Actualización. `sort` is stable, so this only reorders merchantIds —
  // every id from the request is still processed exactly once, just grouped.
  const EXECUTION_ORDER: Record<'create' | 'update' | 'delete', number> = {
    create: 0,
    update: 1,
    delete: 2,
  };
  const orderedMerchantIds = [...merchantIds].sort((a, b) => {
    const statusA = entriesById.get(a)?.status;
    const statusB = entriesById.get(b)?.status;
    const rankA = statusA && statusA !== 'error' ? EXECUTION_ORDER[statusA] : 99;
    const rankB = statusB && statusB !== 'error' ? EXECUTION_ORDER[statusB] : 99;
    return rankA - rankB;
  });

  const results: ApplyResult[] = [];

  for (const merchantId of orderedMerchantIds) {
    const entry = entriesById.get(merchantId);
    if (!entry || entry.status === 'error') continue;
    const action = entry.status;

    try {
      let itemId = entry.itemId;

      if (action === 'create') {
        const created = await withRetry(() =>
          wf.collections.create(merchantsCollectionId, entry.fieldData as { name: string; slug: string }),
        );
        itemId = created.id;
      } else if (action === 'update') {
        await withRetry(() => wf.collections.update(merchantsCollectionId, entry.itemId!, entry.fieldData));
      } else {
        // Cascade delete: Tiendas landing page(s) first, then the Merchant
        // item — Webflow refuses the latter while the former still references it.
        for (const tiendaId of entry.tiendaItemIds ?? []) {
          const tienda = tiendaById.get(tiendaId);
          if (tienda && !tienda.isDraft && tienda.lastPublished) {
            await withRetry(() => wf.collections.unpublishMany(tiendasCollectionId, [tiendaId]));
          }
          await withRetry(() => wf.collections.remove(tiendasCollectionId, tiendaId));
        }
        const merchantItem = await withRetry(() => wf.collections.get(merchantsCollectionId, entry.itemId!));
        if (!merchantItem.isDraft && merchantItem.lastPublished) {
          await withRetry(() => wf.collections.unpublishMany(merchantsCollectionId, [entry.itemId!]));
        }
        await withRetry(() => wf.collections.remove(merchantsCollectionId, entry.itemId!));
      }

      await logAudit(env, {
        userId: user.id,
        userEmail: user.email,
        action,
        siteId,
        collectionId: merchantsCollectionId,
        itemId,
        itemSlug: entry.merchantId,
        diff: { source: 'merchant-sync', status: entry.status, changes: entry.changes },
      });
      results.push({ merchantId, name: entry.name, action, ok: true });
    } catch (err) {
      results.push({ merchantId, name: entry.name, action, ok: false, error: errorMessage(err) });
    }
  }

  const applied = results.filter((r) => r.ok).length;
  const failed = results.length - applied;
  return Response.json({ applied, failed, results });
};
