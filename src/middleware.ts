import { defineMiddleware } from 'astro:middleware';
import { getAuth } from '@lib/auth';
import { isSuperAdmin, parseAllowedSections } from '@lib/authz';

const PUBLIC_PREFIXES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/api/auth',
  '/api/reset-password',
  '/api/diag',
  '/_astro',
];

// BASE_URL is baked in at build time: '/' locally, '/web-marketing-content-manager/' on Webflow Cloud.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Match on segment boundaries so a prefix like '/login' can't accidentally
// expose '/loginsecrets'. A prefix matches an exact path or a sub-path.
function matchesPrefix(appPath: string, p: string): boolean {
  return appPath === p || appPath.startsWith(`${p}/`);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  // Strip mount-path prefix so route checks work identically in local dev and deployed.
  const appPath = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) || '/' : url.pathname;
  // Static favicon files (/favicon.ico, /favicon.svg, …) are always public.
  const isPublic =
    appPath.startsWith('/favicon') || PUBLIC_PREFIXES.some((p) => matchesPrefix(appPath, p));
  // Admin API + pages are restricted to super-admin.
  const isAdminArea = matchesPrefix(appPath, '/api/admin') || matchesPrefix(appPath, '/admin');

  const env = context.locals.runtime?.env;

  if (env?.DB && env?.BETTER_AUTH_SECRET) {
    try {
      const auth = getAuth(env);
      const session = await auth.api.getSession({ headers: context.request.headers });
      if (session?.user) {
        const u = session.user as {
          role?: string;
          allowedSections?: unknown;
        };
        context.locals.user = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: u.role ?? 'editor',
          allowedSections: parseAllowedSections(u.allowedSections),
        };
      }
    } catch (err) {
      console.error('[middleware] session lookup failed', err);
    }
  }

  if (!isPublic && !context.locals.user) {
    return context.redirect(`${BASE}/login?next=${encodeURIComponent(url.pathname)}`);
  }

  // Backstop guard for the whole admin area — endpoints also check inline, but
  // this ensures a forgotten guard on a future /api/admin route can't leak.
  if (isAdminArea && !isSuperAdmin(context.locals.user)) {
    if (appPath.startsWith('/api/')) return new Response('Forbidden', { status: 403 });
    return context.redirect(`${BASE}/dashboard`);
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
