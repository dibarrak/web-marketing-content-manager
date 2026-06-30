/**
 * POST /api/admin/users/:id/password   — Modo A: set a temporary password
 *                                         directly (super-admin only).
 *                                         body: { password }
 */
import type { APIRoute } from 'astro';
import { isSuperAdmin } from '@lib/authz';
import { setPasswordForUser } from '@lib/admin/password';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (!isSuperAdmin(locals.user)) return new Response('Forbidden', { status: 403 });

  const userId = params.id!;
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? '';
  if (password.length < 10)
    return Response.json({ error: 'La contraseña debe tener al menos 10 caracteres.' }, { status: 400 });

  const ok = await setPasswordForUser(locals.runtime.env, userId, password);
  if (!ok)
    return Response.json(
      { error: 'El usuario no tiene una cuenta con contraseña para actualizar.' },
      { status: 400 },
    );

  return Response.json({ ok: true });
};
