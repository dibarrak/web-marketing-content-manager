/**
 * GET  /api/admin/users   — list all users (super-admin only)
 * POST /api/admin/users   — create a user with a temporary password (super-admin only)
 *                           body: { email, name, password, role, allowedSections? }
 */
import type { APIRoute } from 'astro';
import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from '@lib/db';
import { getAuth } from '@lib/auth';
import {
  isSuperAdmin,
  parseAllowedSections,
  sanitizeSections,
  VALID_ROLES,
  type Role,
} from '@lib/authz';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (!isSuperAdmin(locals.user)) return new Response('Forbidden', { status: 403 });

  const db = getDb(locals.runtime.env);
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      allowedSections: schema.users.allowedSections,
      banned: schema.users.banned,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(asc(schema.users.createdAt));

  const users = rows.map((u) => ({
    ...u,
    allowedSections: parseAllowedSections(u.allowedSections),
  }));

  return Response.json({ users });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (!isSuperAdmin(locals.user)) return new Response('Forbidden', { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    name?: string;
    password?: string;
    role?: string;
    allowedSections?: unknown;
  } | null;

  const email = body?.email?.trim().toLowerCase();
  const name = body?.name?.trim();
  const password = body?.password ?? '';
  const role = (body?.role ?? 'editor') as Role;

  if (!email || !name) return Response.json({ error: 'Email y nombre son requeridos.' }, { status: 400 });
  if (password.length < 10)
    return Response.json({ error: 'La contraseña temporal debe tener al menos 10 caracteres.' }, { status: 400 });
  if (!VALID_ROLES.includes(role))
    return Response.json({ error: 'Rol inválido.' }, { status: 400 });

  const env = locals.runtime.env;
  const auth = getAuth(env);

  let userId: string;
  try {
    // createUser handles password hashing + credential account creation, and
    // is authorized by the admin plugin via the super-admin session headers.
    const result = (await auth.api.createUser({
      // `role` is typed to the plugin's default roles; we didn't configure a
      // fixed role set, so any string is accepted at runtime. Cast for TS only.
      body: { email, password, name, role: role as 'admin' },
      headers: request.headers,
    })) as { user: { id: string } };
    userId = result.user.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 400 });
  }

  // Editors get an explicit section list; admins/super-admins get full access (null).
  const allowedSections = role === 'editor' ? sanitizeSections(body?.allowedSections) : null;
  const db = getDb(env);
  await db
    .update(schema.users)
    .set({
      allowedSections: allowedSections ? JSON.stringify(allowedSections) : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId));

  return Response.json({ id: userId }, { status: 201 });
};
