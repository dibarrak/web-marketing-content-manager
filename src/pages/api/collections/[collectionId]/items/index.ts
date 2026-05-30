/**
 * GET  /api/collections/:collectionId/items       — list
 * POST /api/collections/:collectionId/items       — create (body: { fieldData, publish? })
 */
import type { APIRoute } from 'astro';
import { getWebflow } from '@lib/webflow';
import { webflowErrorResponse } from '@lib/webflow/error-response';
import { findCollectionById } from '@lib/config/sites';
import { logAudit } from '@lib/audit';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const collectionId = params.collectionId!;
  const collection = findCollectionById(collectionId);
  if (!collection) return Response.json({ error: 'Unknown collection' }, { status: 404 });

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') ?? 100);
  const offset = Number(url.searchParams.get('offset') ?? 0);

  try {
    const wf = getWebflow(locals.runtime.env);
    const data = await wf.collections.list(collectionId, { limit, offset });
    return Response.json(data);
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

  const body = (await request.json().catch(() => null)) as {
    fieldData?: Record<string, unknown>;
    publish?: boolean;
  } | null;
  if (!body?.fieldData || typeof body.fieldData !== 'object') {
    return Response.json({ error: 'Missing fieldData' }, { status: 400 });
  }

  try {
    const wf = getWebflow(locals.runtime.env);
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
