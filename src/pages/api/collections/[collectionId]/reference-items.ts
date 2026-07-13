/**
 * GET /api/collections/:collectionId/reference-items
 *
 * Lists the items of a collection referenced by a Blog Post field, returning a
 * lightweight `{ id, name }[]` for populating reference/multi-reference pickers.
 *
 * Access is limited to the collections enumerated in BLOG_REFERENCES (in the
 * "Cash" workspace) and gated behind blog-post access — this is not a generic
 * proxy for arbitrary collections.
 */
import type { APIRoute } from 'astro';
import { getWebflow } from '@lib/webflow';
import { webflowErrorResponse } from '@lib/webflow/error-response';
import { BLOG_REFERENCE_COLLECTION_IDS, COLLECTIONS } from '@lib/config/sites';
import { canAccessSection } from '@lib/authz';

export const prerender = false;

export interface ReferenceOption {
  id: string;
  name: string;
}

export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const collectionId = params.collectionId!;
  if (!BLOG_REFERENCE_COLLECTION_IDS.has(collectionId))
    return Response.json({ error: 'Unknown reference collection' }, { status: 404 });
  // Reference pickers are only used from the Blog Posts editor, so gate on that.
  if (!canAccessSection(user, 'blogPosts')) return new Response('Forbidden', { status: 403 });

  try {
    // Referenced blog collections live in the same workspace as Blog Posts.
    const wf = getWebflow(locals.runtime.env, COLLECTIONS.blogPosts.workspace);
    // Page through so pickers show every option (Webflow caps limit at 100).
    const options: ReferenceOption[] = [];
    let offset = 0;
    for (;;) {
      const data = await wf.collections.list<{ name: string }>(collectionId, {
        limit: 100,
        offset,
      });
      for (const item of data.items) {
        options.push({ id: item.id, name: item.fieldData.name });
      }
      offset += data.items.length;
      if (data.items.length === 0 || offset >= data.pagination.total) break;
    }

    options.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return Response.json({ options });
  } catch (err) {
    return webflowErrorResponse(err);
  }
};
