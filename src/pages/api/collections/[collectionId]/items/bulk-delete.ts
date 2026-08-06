/**
 * POST /api/collections/:collectionId/items/bulk-delete   body: { itemIds: string[] }
 *
 * Deletes several items in two bulk passes:
 *   1. unpublish  — removes them from the live site (verified: takes effect
 *      immediately, no site republish needed)
 *   2. delete      — removes them from the CMS
 *
 * Cost: one paginated list (for the audit log's "before" state) plus two calls
 * per 100 items, instead of the 2 calls per item the single-item route needs.
 * That matters — Webflow allows 60 requests/minute on Starter/Basic plans.
 */
import type { APIRoute } from 'astro';
import { getWebflow } from '@lib/webflow';
import { BULK_ITEM_LIMIT, type CollectionItem } from '@lib/webflow/collections';
import { webflowErrorResponse } from '@lib/webflow/error-response';
import { findCollectionById } from '@lib/config/sites';
import { canAccessCollection } from '@lib/authz';
import { logAudit } from '@lib/audit';

export const prerender = false;

/** Refuses oversized requests outright rather than hammering the rate limit. */
const MAX_ITEMS_PER_REQUEST = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const collectionId = params.collectionId!;
  const collection = findCollectionById(collectionId);
  if (!collection) return Response.json({ error: 'Unknown collection' }, { status: 404 });
  if (!canAccessCollection(user, collectionId))
    return new Response('Forbidden', { status: 403 });

  const body = (await request.json().catch(() => null)) as { itemIds?: unknown } | null;
  const requested = Array.isArray(body?.itemIds) ? body!.itemIds : null;
  if (!requested || requested.some((id) => typeof id !== 'string' || !id)) {
    return Response.json({ error: 'Missing or invalid itemIds' }, { status: 400 });
  }
  const itemIds = [...new Set(requested as string[])];
  if (itemIds.length === 0) {
    return Response.json({ error: 'itemIds is empty' }, { status: 400 });
  }
  if (itemIds.length > MAX_ITEMS_PER_REQUEST) {
    return Response.json(
      { error: `Máximo ${MAX_ITEMS_PER_REQUEST} items por operación.` },
      { status: 400 },
    );
  }

  try {
    const wf = getWebflow(locals.runtime.env, collection.workspace);

    // One list beats one GET per item: we need each item's fieldData for the
    // audit log, and its publish state to know whether unpublishing applies.
    // Re-read server-side rather than trusting the client — an audit log built
    // from client-supplied values would be forgeable.
    const existing = new Map<string, CollectionItem>();
    for (let offset = 0; ; ) {
      const page = await wf.collections.list(collectionId, { limit: 100, offset });
      for (const item of page.items) existing.set(item.id, item);
      offset += page.items.length;
      if (page.items.length === 0 || offset >= page.pagination.total) break;
    }

    const found = itemIds.filter((id) => existing.has(id));
    const missing = itemIds.filter((id) => !existing.has(id));
    if (found.length === 0) {
      return Response.json({ error: 'Ningún item existe en la colección.', missing }, { status: 404 });
    }

    // Unpublishing an item that was never published errors, so skip drafts.
    const published = found.filter((id) => {
      const item = existing.get(id)!;
      return !item.isDraft && !!item.lastPublished;
    });

    const unpublishFailures: { ids: string[]; error: string }[] = [];
    for (const batch of chunk(published, BULK_ITEM_LIMIT)) {
      try {
        await wf.collections.unpublishMany(collectionId, batch);
      } catch (err) {
        // Report rather than abort: the CMS delete below is what the user asked
        // for, and leaving the items half-processed would be worse.
        unpublishFailures.push({
          ids: batch,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const deleted: string[] = [];
    const deleteFailures: { ids: string[]; error: string }[] = [];
    for (const batch of chunk(found, BULK_ITEM_LIMIT)) {
      try {
        await wf.collections.removeMany(collectionId, batch);
        deleted.push(...batch);
      } catch (err) {
        deleteFailures.push({
          ids: batch,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // One audit entry per item, so the log stays queryable by item like the
    // single-item delete path.
    for (const id of deleted) {
      const before = existing.get(id)!;
      await logAudit(locals.runtime.env, {
        userId: user.id,
        userEmail: user.email,
        action: 'delete',
        siteId: collection.siteId,
        collectionId,
        itemId: id,
        itemSlug: before.fieldData.slug,
        diff: { before: before.fieldData, bulk: true },
      });
    }

    return Response.json({
      deleted,
      deletedCount: deleted.length,
      unpublished: published.filter((id) => deleted.includes(id)).length,
      skippedDrafts: found.length - published.length,
      ...(missing.length > 0 ? { missing } : {}),
      ...(unpublishFailures.length > 0 ? { unpublishFailures } : {}),
      ...(deleteFailures.length > 0 ? { deleteFailures } : {}),
    });
  } catch (err) {
    return webflowErrorResponse(err);
  }
};
