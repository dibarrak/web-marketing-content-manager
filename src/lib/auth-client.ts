import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? `${window.location.origin}${base}/api/auth` : undefined,
  plugins: [adminClient()],
});

export const { signIn, signUp, signOut, useSession, changePassword, admin } = authClient;
