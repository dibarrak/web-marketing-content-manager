/**
 * POST /api/assets/upload
 *   multipart/form-data:
 *     - file: image binary (jpeg/png/webp/avif/etc)
 *     - collectionId: which collection (resolves siteId from config), OR
 *     - siteId: a known Webflow site id (for uploads not tied to a collection,
 *       e.g. merchant logos). One of collectionId/siteId is required.
 *     - maxDimension?: optional resize cap (number)
 *
 * Returns: { id, url, width, height, originalSize, compressedSize }
 */
import type { APIRoute } from 'astro';
import { getWebflow } from '@lib/webflow';
import { toWebp, replaceExtensionWithWebp } from '@lib/images/webp';
import { findCollectionById, isKnownSiteId, workspaceForSite } from '@lib/config/sites';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid multipart body' }, { status: 400 });
  }

  const file = form.get('file');
  const collectionId = form.get('collectionId');
  const siteIdRaw = form.get('siteId');
  const maxDimRaw = form.get('maxDimension');

  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing file' }, { status: 400 });
  }

  // Resolve the destination site: prefer collectionId (existing callers), fall
  // back to an explicit, known siteId (merchant logos and other non-collection
  // uploads).
  let siteId: string;
  if (typeof collectionId === 'string') {
    const collection = findCollectionById(collectionId);
    if (!collection) {
      return Response.json({ error: 'Unknown collection' }, { status: 400 });
    }
    siteId = collection.siteId;
  } else if (typeof siteIdRaw === 'string' && isKnownSiteId(siteIdRaw)) {
    siteId = siteIdRaw;
  } else {
    return Response.json({ error: 'Missing collectionId or siteId' }, { status: 400 });
  }

  const maxDimension = typeof maxDimRaw === 'string' ? Number(maxDimRaw) : undefined;

  try {
    const buf = await file.arrayBuffer();
    const webp = await toWebp(buf, { maxDimension });
    const fileName = replaceExtensionWithWebp(file.name || 'upload.bin');
    const wf = getWebflow(locals.runtime.env, workspaceForSite(siteId));
    const uploaded = await wf.assets.upload(siteId, fileName, webp.bytes, 'image/webp');
    return Response.json({
      id: uploaded.id,
      url: uploaded.url,
      width: webp.width,
      height: webp.height,
      originalSize: webp.originalSize,
      compressedSize: webp.compressedSize,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    console.error('[api/assets/upload]', err);
    return Response.json({ error: message }, { status: 500 });
  }
};
