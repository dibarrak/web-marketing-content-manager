import { createAuthClient } from 'better-auth/react';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? `${window.location.origin}${base}/api/auth` : undefined,
});

export const { signIn, signUp, signOut, useSession } = authClient;
