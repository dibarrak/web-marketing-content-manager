import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/admin/access';
import { getDb, schema } from './db';

// Access-control roles for the admin plugin. Any role listed in `adminRoles`
// MUST be defined here, so all three app roles are declared.
const ac = createAccessControl(defaultStatements);
const roles = {
  // Full Better Auth admin permissions — may manage users.
  'super-admin': ac.newRole({
    user: ['create', 'list', 'set-role', 'ban', 'impersonate', 'delete', 'set-password', 'get', 'update'],
    session: ['list', 'revoke', 'delete'],
  }),
  // App-level roles with no Better Auth user-management permissions; their
  // content access is enforced separately in @lib/authz.
  admin: ac.newRole({ user: [], session: [] }),
  editor: ac.newRole({ user: [], session: [] }),
};

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
        // JSON-encoded CollectionKey[] for editors; null = full access.
        // input:false so it can't be self-assigned at signup — only the
        // super-admin sets it through the admin endpoints.
        allowedSections: { type: 'string', required: false, input: false },
      },
    },
    plugins: [
      admin({
        ac,
        roles,
        // New self-signups land as 'editor' with no sections until a
        // super-admin grants access.
        defaultRole: 'editor',
        // Only 'super-admin' may use the admin endpoints (listUsers,
        // setRole, createUser, setUserPassword, …).
        adminRoles: ['super-admin'],
      }),
    ],
  });
}

export type AuthInstance = ReturnType<typeof getAuth>;
