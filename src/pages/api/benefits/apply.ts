/**
 * POST /api/benefits/apply
 *   body: { month: string, merchantIds: string[], tiendaIds?: Record<merchantId, tiendaId> }
 *
 * Re-computes the diff server-side (never trusts client payloads) and applies
 * only the selected merchants:
 *  - "changed": exists in both the sheet snapshot and the Benefits collection
 *    → partial PATCH.
 *  - "new": exists in the sheet and has a landing in Tiendas but no Benefits
 *    item → create the item linked to the Tienda, then write the
 *    back-reference on the Tienda. The client names the Tienda per merchant;
 *    the server re-fetches it and verifies its merchant-id, draft state and
 *    that it isn't already linked (so we never list all ~4.5k Tiendas per batch).
 * Out-of-source / draft / no_landing / unchanged are never written. Items are written to the STAGED
 * endpoint (not published) so the change is reviewed in staging and shipped
 * later via the publish control. Admin & super-admin only.
 *
 * Updates run strictly one after another through `withRetry`, which waits out
 * Webflow's 429 (Retry-After) instead of failing. The client sends the
 * selection in small batches (see MAX_MERCHANTS_PER_REQUEST) so a single
 * Worker invocation never has to make an unbounded number of subrequests.
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@lib/authz';
import { BENEFITS_COLLECTION } from '@lib/config/sites';
import { getWebflow } from '@lib/webflow';
import { withRetry } from '@lib/merchant-sync/webflow';
import { MERCHANT_SYNC } from '@lib/config/sites';
import { toTiendaRef } from '@lib/benefits/items';
import { getSnapshot } from '@lib/benefits/snapshots';
import { fetchAllBenefitItems } from '@lib/benefits/items';
import { computeDiff, TIENDA_BENEFIT_REF, type DiffEntry, type TiendaRef } from '@lib/benefits/sync';
import { logAudit } from '@lib/audit';
import { WebflowApiError } from '@lib/webflow';
import { webflowErrorResponse } from '@lib/webflow/error-response';

export const prerender = false;

/**
 * Webflow Cloud cuts a request off at ~20s with a 504. The loop stops starting
 * new merchants after this budget and returns the rest as `pending`, so the UI
 * just sends them again instead of the whole request dying mid-way.
 */
const TIME_BUDGET_MS = 11_000;
/** Longest 429 wait we sit through inline; anything longer goes back to the UI. */
const MAX_INLINE_WAIT_SECONDS = 4;
const SHORT_RETRY = { maxWaitSeconds: MAX_INLINE_WAIT_SECONDS };

/** Cap per request; keeps Worker subrequests bounded. The UI batches below this. */
export const MAX_MERCHANTS_PER_REQUEST = 50;

interface ApplyResult {
  merchantId: string;
  name: string;
  action: 'create' | 'update';
  ok: boolean;
  error?: string;
}

function errMessage(err: unknown): string {
  if (err instanceof WebflowApiError) {
    return err.status === 429 ? 'Rate limit de Webflow; reintenta en un momento.' : err.message;
  }
  return err instanceof Error ? err.message : 'Error desconocido.';
}

export const POST: APIRoute = async ({ request, locals }) => {
  const startedAt = Date.now();
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isAdmin(user)) return new Response('Forbidden', { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    month?: string;
    merchantIds?: string[];
    tiendaIds?: Record<string, string>;
  } | null;
  const month = body?.month?.trim();
  const merchantIds = Array.isArray(body?.merchantIds) ? body!.merchantIds : [];
  if (!month) return Response.json({ error: 'Falta month.' }, { status: 400 });
  if (merchantIds.length === 0)
    return Response.json({ error: 'No se seleccionaron merchants.' }, { status: 400 });

  if (merchantIds.length > MAX_MERCHANTS_PER_REQUEST)
    return Response.json(
      { error: `Máximo ${MAX_MERCHANTS_PER_REQUEST} merchants por solicitud.` },
      { status: 400 },
    );

  const env = locals.runtime.env;
  const { collectionId, siteId } = BENEFITS_COLLECTION;

  let entriesById: Map<string, DiffEntry>;
  try {
    const data = await getSnapshot(env, month);
    if (!data) {
      return Response.json(
        { error: `No hay datos para "${month}". Envíalos primero desde el Apps Script.` },
        { status: 404 },
      );
    }
    const existing = await fetchAllBenefitItems(env, collectionId, SHORT_RETRY);

    // Resolve only the Tiendas the client asked to link, straight from Webflow.
    const wfRead = getWebflow(env);
    const tiendas: TiendaRef[] = [];
    for (const [merchantId, tiendaId] of Object.entries(body?.tiendaIds ?? {})) {
      if (!merchantIds.includes(merchantId) || typeof tiendaId !== 'string') continue;
      try {
        const t = await withRetry(
          () => wfRead.collections.get(MERCHANT_SYNC.tiendasCollectionId, tiendaId),
          SHORT_RETRY,
        );
        const ref = toTiendaRef({ id: t.id, isDraft: t.isDraft, fieldData: t.fieldData });
        if (ref && ref.merchantId === merchantId) tiendas.push(ref);
      } catch (err) {
        // Rate-limited: bail so the UI retries; otherwise an unresolvable Tienda
        // just drops the merchant to "no_landing" and it is skipped.
        if (err instanceof WebflowApiError && err.status === 429) throw err;
      }
    }
    const report = computeDiff(data, existing, tiendas);
    entriesById = new Map(report.entries.map((e) => [e.merchantId, e]));
  } catch (err) {
    return webflowErrorResponse(err);
  }

  const wf = getWebflow(env);
  const results: ApplyResult[] = [];

  const pending: string[] = [];
  let retryAfter: number | undefined;

  for (const [idx, merchantId] of merchantIds.entries()) {
    // Out of time (or rate-limited): hand the rest back for another request.
    if (retryAfter !== undefined || Date.now() - startedAt > TIME_BUDGET_MS) {
      pending.push(...merchantIds.slice(idx));
      break;
    }
    const entry = entriesById.get(merchantId);
    // Only "changed" (in both sheet and CMS) and "new" (sheet + Tienda landing)
    // are applied; everything else is never touched, even if the client asked.
    if (!entry || (entry.status !== 'changed' && entry.status !== 'new')) continue;
    const action: 'create' | 'update' = entry.isCreate ? 'create' : 'update';
    try {
      let itemId = entry.itemId;
      let linkError: string | undefined;
      if (entry.isCreate) {
        const created = await withRetry(
          () => wf.collections.create(collectionId, entry.fieldData as { name: string; slug: string }),
          SHORT_RETRY,
        );
        itemId = created.id;
        // Back-reference on the Tienda so the landing points at its new item.
        try {
          await withRetry(
            () =>
              wf.collections.update(MERCHANT_SYNC.tiendasCollectionId, entry.tiendaId!, {
                [TIENDA_BENEFIT_REF]: created.id,
              }),
            SHORT_RETRY,
          );
          await logAudit(env, {
            userId: user.id,
            userEmail: user.email,
            action: 'update',
            siteId,
            collectionId: MERCHANT_SYNC.tiendasCollectionId,
            itemId: entry.tiendaId,
            itemSlug: entry.merchantId,
            diff: { source: 'benefits-sync', month, link: { [TIENDA_BENEFIT_REF]: created.id } },
          });
        } catch (err) {
          linkError = errMessage(err);
        }
      } else {
        const id = entry.itemId!;
        await withRetry(() => wf.collections.update(collectionId, id, entry.fieldData), SHORT_RETRY);
      }
      await logAudit(env, {
        userId: user.id,
        userEmail: user.email,
        action,
        siteId,
        collectionId,
        itemId,
        itemSlug: entry.merchantId,
        diff: { source: 'benefits-sync', month, status: entry.status, changes: entry.changes },
      });
      results.push(
        linkError
          ? {
              merchantId,
              name: entry.name,
              action,
              ok: false,
              error: `Item creado, pero no se pudo vincular en Tiendas: ${linkError}`,
            }
          : { merchantId, name: entry.name, action, ok: true },
      );
    } catch (err) {
      if (err instanceof WebflowApiError && err.status === 429) {
        // Nothing was written for this merchant (create/update failed up front):
        // retry it, with the rest, after Webflow's window.
        retryAfter = err.retryAfterSeconds ?? 10;
        pending.push(merchantId);
        continue;
      }
      results.push({ merchantId, name: entry.name, action, ok: false, error: errMessage(err) });
    }
  }

  const applied = results.filter((r) => r.ok).length;
  const failed = results.length - applied;
  return Response.json({ month, applied, failed, results, pending, retryAfter });
};
