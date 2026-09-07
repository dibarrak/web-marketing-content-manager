/**
 * POST /api/emergency-reset   — TEMPORARY. Not exposed in the admin UI.
 *
 * Break-glass password reset for when no super-admin session is available
 * (e.g. locked out of production). No user session required — authenticated
 * with a shared secret (EMERGENCY_RESET_SECRET) sent in the
 * `Authorization: Bearer <secret>` header, same pattern as
 * /api/benefits/ingest.
 *
 * Body: { email: string, password: string }
 *
 * REMOVE THIS FILE (and its EMERGENCY_RESET_SECRET entry in middleware.ts /
 * env.d.ts / Webflow Cloud env vars) after using it once.
 */
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@lib/db';
import { setPasswordForUser } from '@lib/admin/password';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const expected = env.EMERGENCY_RESET_SECRET;
  if (!expected) return Response.json({ error: 'No configurado.' }, { status: 503 });

  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== expected) return new Response('Unauthorized', { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  const email = body?.email?.trim().toLowerCase() ?? '';
  const password = body?.password ?? '';
  if (!email) return Response.json({ error: 'Falta email.' }, { status: 400 });
  if (password.length < 10)
    return Response.json({ error: 'La contraseña debe tener al menos 10 caracteres.' }, { status: 400 });

  const db = getDb(env);
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (!user) return Response.json({ error: 'Usuario no encontrado.' }, { status: 404 });

  const ok = await setPasswordForUser(env, user.id, password);
  if (!ok)
    return Response.json(
      { error: 'El usuario no tiene una cuenta con contraseña para actualizar.' },
      { status: 400 },
    );

  return Response.json({ ok: true });
};
