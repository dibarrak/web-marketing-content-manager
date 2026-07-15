/**
 * GET    /api/collections/:collectionId/items/:itemId
 * PATCH  /api/collections/:collectionId/items/:itemId   (body: { fieldData, publish? })
 * DELETE /api/collections/:collectionId/items/:itemId
 */
import type { APIRoute } from 'astro';
import { getWebflow } from '@lib/webflow';
import { webflowErrorResponse } from '@lib/webflow/error-response';
import { findCollectionById } from '@lib/config/sites';
import { canAccessCollection } from '@lib/authz';
import { logAudit } from '@lib/audit';

export const prerender = false;

function unauth() {
  return new Response('Unauthorized', { status: 401 });
}

function forbidden() {
  return new Response('Forbidden', { status: 403 });
}

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return unauth();
  const { collectionId, itemId } = params as { collectionId: string; itemId: string };
  const collection = findCollectionById(collectionId);
  if (!collection)
    return Response.json({ error: 'Unknown collection' }, { status: 404 });
  if (!canAccessCollection(locals.user, collectionId)) return forbidden();

  try {
    const wf = getWebflow(locals.runtime.env, collection.workspace);
    const item = await wf.collections.get(collectionId, itemId);
    return Response.json(item);
  } catch (err) {
    return webflowErrorResponse(err);
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) return unauth();
  const { collectionId, itemId } = params as { collectionId: string; itemId: string };
  const collection = findCollectionById(collectionId);
  if (!collection) return Response.json({ error: 'Unknown collection' }, { status: 404 });
  if (!canAccessCollection(user, collectionId)) return forbidden();

  const body = (await request.json().catch(() => null)) as {
    fieldData?: Record<string, unknown>;
    publish?: boolean;
  } | null;
  if (!body?.fieldData) return Response.json({ error: 'Missing fieldData' }, { status: 400 });

  try {
    const wf = getWebflow(locals.runtime.env, collection.workspace);
    const before = await wf.collections.get(collectionId, itemId).catch(() => null);

    // Webflow rejects a "live" PATCH on an item that has never been published
    // (there's no live version yet to update) — this happens for items created
    // directly in Webflow and left as a draft. Detect that case and fall back
    // to a plain PATCH followed by an explicit first-time publish.
    const neverPublished = !before?.lastPublished;
    let updated = await wf.collections.update(collectionId, itemId, body.fieldData, {
      publish: body.publish && !neverPublished,
    });
    if (body.publish && neverPublished) {
      await wf.collections.publish(collectionId, [itemId]);
      updated = await wf.collections.get(collectionId, itemId);
    }

    await logAudit(locals.runtime.env, {
      userId: user.id,
      userEmail: user.email,
      action: 'update',
      siteId: collection.siteId,
      collectionId,
      itemId: updated.id,
      itemSlug: updated.fieldData.slug,
      diff: { before: before?.fieldData, after: updated.fieldData },
    });

    return Response.json(updated);
  } catch (err) {
    return webflowErrorResponse(err);
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return unauth();
  const { collectionId, itemId } = params as { collectionId: string; itemId: string };
  const collection = findCollectionById(collectionId);
  if (!collection) return Response.json({ error: 'Unknown collection' }, { status: 404 });
  if (!canAccessCollection(user, collectionId)) return forbidden();

  try {
    const wf = getWebflow(locals.runtime.env, collection.workspace);
    const before = await wf.collections.get(collectionId, itemId).catch(() => null);
    await wf.collections.remove(collectionId, itemId);

    await logAudit(locals.runtime.env, {
      userId: user.id,
      userEmail: user.email,
      action: 'delete',
      siteId: collection.siteId,
      collectionId,
      itemId,
      itemSlug: before?.fieldData.slug,
      diff: { before: before?.fieldData },
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    return webflowErrorResponse(err);
  }
};
