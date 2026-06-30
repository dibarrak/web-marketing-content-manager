/**
 * POST /api/admin/users/:id/reset-link   — Modo B: generate a single-use,
 *   24h password-reset token (super-admin only). Returns the plaintext token
 *   once; only its hash is stored. The super-admin shares the resulting link
 *   manually (no email is sent).
 */
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@lib/db';
import { isSuperAdmin } from '@lib/authz';
import { generateResetToken, hashToken } from '@lib/admin/password';

export const prerender = false;

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const POST: APIRoute = async ({ params, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });
  if (!isSuperAdmin(locals.user)) return new Response('Forbidden', { status: 403 });

  const userId = params.id!;
  const env = locals.runtime.env;
  const db = getDb(env);

  const [target] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  if (!target) return Response.json({ error: 'Usuario no encontrado.' }, { status: 404 });

  const token = generateResetToken();
  const tokenHash = await hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);

  await db.insert(schema.passwordResetTokens).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash,
    expiresAt,
    createdBy: locals.user.id,
    createdAt: now,
  });

  return Response.json({ token, expiresAt: expiresAt.toISOString() });
};
