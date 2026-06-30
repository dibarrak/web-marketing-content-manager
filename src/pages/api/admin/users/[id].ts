/**
 * PATCH  /api/admin/users/:id   — update role and/or allowedSections (super-admin only)
 *                                 body: { role?, allowedSections? }
 * DELETE /api/admin/users/:id   — remove a user (super-admin only)
 */
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@lib/db';
import { getAuth } from '@lib/auth';
import { isSuperAdmin, sanitizeSections, VALID_ROLES, type Role } from '@lib/authz';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (!isSuperAdmin(locals.user)) return new Response('Forbidden', { status: 403 });

  const userId = params.id!;
  const body = (await request.json().catch(() => null)) as {
    role?: string;
    allowedSections?: unknown;
  } | null;
  if (!body) return Response.json({ error: 'Cuerpo inválido.' }, { status: 400 });

  const db = getDb(locals.runtime.env);
  const [target] = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  if (!target) return Response.json({ error: 'Usuario no encontrado.' }, { status: 404 });

  // Resolve the role after this update (provided or current).
  const nextRole = (body.role ?? target.role) as Role;
  if (body.role !== undefined && !VALID_ROLES.includes(nextRole))
    return Response.json({ error: 'Rol inválido.' }, { status: 400 });

  // Guard: a super-admin cannot demote themselves (avoid locking out the last one).
  if (userId === locals.user.id && nextRole !== 'super-admin')
    return Response.json({ error: 'No puedes cambiar tu propio rol de super-admin.' }, { status: 400 });

  const updates: Partial<typeof schema.users.$inferInsert> = { updatedAt: new Date() };
  if (body.role !== undefined) updates.role = nextRole;

  // Sections only apply to editors; any other role implies full access (null).
  if (nextRole !== 'editor') {
    updates.allowedSections = null;
  } else if (body.allowedSections !== undefined || body.role !== undefined) {
    updates.allowedSections = JSON.stringify(sanitizeSections(body.allowedSections));
  }

  await db.update(schema.users).set(updates).where(eq(schema.users.id, userId));

  // Revoke the target's sessions so the new role/sections take effect on their
  // next request instead of lingering in the signed session cookie cache.
  if (body.role !== undefined || updates.allowedSections !== undefined) {
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  }

  return Response.json({ ok: true });
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (!isSuperAdmin(locals.user)) return new Response('Forbidden', { status: 403 });

  const userId = params.id!;
  if (userId === locals.user.id)
    return Response.json({ error: 'No puedes eliminar tu propia cuenta.' }, { status: 400 });

  const env = locals.runtime.env;
  const auth = getAuth(env);
  try {
    await auth.api.removeUser({ body: { userId }, headers: request.headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 400 });
  }
  return new Response(null, { status: 204 });
};
