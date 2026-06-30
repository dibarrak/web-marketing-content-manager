/**
 * Password + reset-token helpers for the super-admin user-management flows.
 *
 * Password hashing uses better-auth's own `hashPassword` (default scrypt), so
 * credentials written here are fully compatible with the normal sign-in path.
 */
import { hashPassword, generateRandomString } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@lib/db';

/** Provider id better-auth assigns to email/password (credential) accounts. */
const CREDENTIAL_PROVIDER = 'credential';

/**
 * Set (overwrite) a user's password and revoke all their active sessions.
 * Returns false if the user has no credential account to update.
 */
export async function setPasswordForUser(
  env: Env,
  userId: string,
  newPassword: string,
): Promise<boolean> {
  const hashed = await hashPassword(newPassword);
  const db = getDb(env);

  const updated = await db
    .update(schema.accounts)
    .set({ password: hashed, updatedAt: new Date() })
    .where(
      and(
        eq(schema.accounts.userId, userId),
        eq(schema.accounts.providerId, CREDENTIAL_PROVIDER),
      ),
    )
    .returning({ id: schema.accounts.id });

  if (updated.length === 0) return false;

  // Force re-login everywhere with the new credentials.
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  return true;
}

/** Generate a high-entropy, URL-safe reset token (plaintext, shown once). */
export function generateResetToken(): string {
  return generateRandomString(48, 'a-z', 'A-Z', '0-9');
}

/** SHA-256 hex of a token — only the hash is persisted. */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
