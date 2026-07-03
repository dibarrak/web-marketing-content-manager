/**
 * POST /api/benefits/apply  body: { month: string, merchantIds: string[] }
 *
 * Re-computes the diff server-side (never trusts client payloads) and applies
 * only the selected merchants. Items are written to the STAGED endpoint (not
 * published) so the change is reviewed in staging and shipped later via the
 * publish control. Admin & super-admin only.
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@lib/authz';
import { BENEFITS_COLLECTION } from '@lib/config/sites';
import { getWebflow } from '@lib/webflow';
import { getSnapshot } from '@lib/benefits/snapshots';
import { fetchAllBenefitItems } from '@lib/benefits/items';
import { computeDiff, type DiffEntry } from '@lib/benefits/sync';
import { logAudit } from '@lib/audit';
import { WebflowApiError } from '@lib/webflow';
import { webflowErrorResponse } from '@lib/webflow/error-response';

export const prerender = false;

interface ApplyResult {
  merchantId: string;
  name: string;
  action: 'create' | 'update';
  ok: boolean;
  error?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isAdmin(user)) return new Response('Forbidden', { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    month?: string;
    merchantIds?: string[];
  } | null;
  const month = body?.month?.trim();
  const merchantIds = Array.isArray(body?.merchantIds) ? body!.merchantIds : [];
  if (!month) return Response.json({ error: 'Falta month.' }, { status: 400 });
  if (merchantIds.length === 0)
    return Response.json({ error: 'No se seleccionaron merchants.' }, { status: 400 });

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
    const existing = await fetchAllBenefitItems(env, collectionId);
    const report = computeDiff(data, existing);
    entriesById = new Map(report.entries.map((e) => [e.merchantId, e]));
  } catch (err) {
    return webflowErrorResponse(err);
  }

  const wf = getWebflow(env);
  const results: ApplyResult[] = [];

  for (const merchantId of merchantIds) {
    const entry = entriesById.get(merchantId);
    // Only actionable statuses are applied. Drafts and unchanged are never
    // touched, even if the client asked for them.
    if (!entry || !['new', 'changed', 'out_of_source'].includes(entry.status)) continue;
    const action: 'create' | 'update' = entry.isCreate ? 'create' : 'update';
    try {
      let itemId = entry.itemId;
      if (entry.isCreate) {
        const created = await wf.collections.create(
          collectionId,
          entry.fieldData as { name: string; slug: string },
        );
        itemId = created.id;
      } else {
        await wf.collections.update(collectionId, entry.itemId!, entry.fieldData);
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
      results.push({ merchantId, name: entry.name, action, ok: true });
    } catch (err) {
      const message =
        err instanceof WebflowApiError
          ? err.status === 429
            ? 'Rate limit de Webflow; reintenta en un momento.'
            : err.message
          : err instanceof Error
            ? err.message
            : 'Error desconocido.';
      results.push({ merchantId, name: entry.name, action, ok: false, error: message });
    }
  }

  const applied = results.filter((r) => r.ok).length;
  const failed = results.length - applied;
  return Response.json({ month, applied, failed, results });
};
