/**
 * GET  /api/collections/:collectionId/items       — list
 * POST /api/collections/:collectionId/items       — create (body: { fieldData, publish? })
 */
import type { APIRoute } from 'astro';
import { getWebflow } from '@lib/webflow';
import { webflowErrorResponse } from '@lib/webflow/error-response';
import { findCollectionById } from '@lib/config/sites';
import { canAccessCollection } from '@lib/authz';
import { logAudit } from '@lib/audit';

export const prerender = false;

/** Webflow's maximum page size for collection items. */
const PAGE_SIZE = 100;
/** Safety stop: 2000 items. Beyond this the request would risk the rate limit. */
const MAX_PAGES = 20;

export const GET: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const collectionId = params.collectionId!;
  const collection = findCollectionById(collectionId);
  if (!collection) return Response.json({ error: 'Unknown collection' }, { status: 404 });
  if (!canAccessCollection(user, collectionId))
    return new Response('Forbidden', { status: 403 });

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get('limit');
  const rawOffset = url.searchParams.get('offset');

  try {
    const wf = getWebflow(locals.runtime.env, collection.workspace);

    // An explicit limit/offset means the caller wants that exact page.
    if (rawLimit !== null || rawOffset !== null) {
      const data = await wf.collections.list(collectionId, {
        limit: Number(rawLimit ?? 100),
        offset: Number(rawOffset ?? 0),
      });
      return Response.json(data);
    }

    // Otherwise return the whole collection. Webflow caps a page at 100, and
    // the UI sorts and filters client-side, so a partial list silently produces
    // wrong results (e.g. sorting by `orden` over only the first 100 items).
    const items: Awaited<ReturnType<typeof wf.collections.list>>['items'] = [];
    let total = 0;
    let truncated = false;
    for (let page = 0; ; page++) {
      // Guard against an unbounded loop on a very large collection; Webflow
      // also rate-limits to 60 requests/minute per token.
      if (page >= MAX_PAGES) {
        truncated = true;
        break;
      }
      const data = await wf.collections.list(collectionId, {
        limit: PAGE_SIZE,
        offset: items.length,
      });
      total = data.pagination.total;
      items.push(...data.items);
      if (data.items.length === 0 || items.length >= total) break;
    }

    return Response.json({
      items,
      pagination: { limit: items.length, offset: 0, total },
      // Surfaced so the UI can say so instead of pretending it has everything.
      ...(truncated ? { truncated: true } : {}),
    });
  } catch (err) {
    return webflowErrorResponse(err);
  }
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const collectionId = params.collectionId!;
  const collection = findCollectionById(collectionId);
  if (!collection) return Response.json({ error: 'Unknown collection' }, { status: 404 });
  if (!canAccessCollection(user, collectionId))
    return new Response('Forbidden', { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    fieldData?: Record<string, unknown>;
    publish?: boolean;
  } | null;
  if (!body?.fieldData || typeof body.fieldData !== 'object') {
    return Response.json({ error: 'Missing fieldData' }, { status: 400 });
  }

  try {
    const wf = getWebflow(locals.runtime.env, collection.workspace);
    const created = await wf.collections.create(
      collectionId,
      body.fieldData as { name: string; slug: string },
      { publish: body.publish },
    );

    await logAudit(locals.runtime.env, {
      userId: user.id,
      userEmail: user.email,
      action: 'create',
      siteId: collection.siteId,
      collectionId,
      itemId: created.id,
      itemSlug: created.fieldData.slug,
      diff: { after: created.fieldData },
    });

    return Response.json(created, { status: 201 });
  } catch (err) {
    return webflowErrorResponse(err);
  }
};
