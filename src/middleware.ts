import { defineMiddleware } from 'astro:middleware';
import { getAuth } from '@lib/auth';

const PUBLIC_PREFIXES = ['/login', '/api/auth', '/api/diag', '/_astro', '/favicon'];

// BASE_URL is baked in at build time: '/' locally, '/web-marketing-content-manager/' on Webflow Cloud.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  // Strip mount-path prefix so route checks work identically in local dev and deployed.
  const appPath = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) || '/' : url.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => appPath.startsWith(p));

  const env = context.locals.runtime?.env;

  if (env?.DB && env?.BETTER_AUTH_SECRET) {
    try {
      const auth = getAuth(env);
      const session = await auth.api.getSession({ headers: context.request.headers });
      if (session?.user) {
        context.locals.user = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: (session.user as { role?: string }).role ?? 'editor',
        };
      }
    } catch (err) {
      console.error('[middleware] session lookup failed', err);
    }
  }

  if (!isPublic && !context.locals.user) {
    return context.redirect(`${BASE}/login?next=${encodeURIComponent(url.pathname)}`);
  }

  if (appPath === '/login' && context.locals.user) {
    return context.redirect(`${BASE}/dashboard`);
  }

  const response = await next();

  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');

  return response;
});
