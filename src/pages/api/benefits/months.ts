/**
 * GET /api/benefits/months — list months that have a stored snapshot.
 * Admin & super-admin only.
 */
import type { APIRoute } from 'astro';
import { isAdmin } from '@lib/authz';
import { listMonths } from '@lib/benefits/snapshots';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isAdmin(user)) return new Response('Forbidden', { status: 403 });

  try {
    const months = await listMonths(locals.runtime.env);
    return Response.json({ months });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Error consultando snapshots.' },
      { status: 500 },
    );
  }
};
