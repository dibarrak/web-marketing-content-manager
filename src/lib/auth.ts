import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb, schema } from './db';

/**
 * Per-request Better Auth instance. The D1 binding lives in runtime env,
 * so we build the instance lazily inside endpoints/middleware.
 */
export function getAuth(env: Env) {
  const db = getDb(env);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 10,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh once a day
      cookieCache: { enabled: true, maxAge: 60 * 5 }, // 5 min edge cache
    },
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'editor', input: false },
      },
    },
  });
}

export type AuthInstance = ReturnType<typeof getAuth>;
