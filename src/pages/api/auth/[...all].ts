import type { APIRoute } from 'astro';
import { getAuth } from '@lib/auth';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const handle: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  if (!env?.DB) {
    return new Response(JSON.stringify({ error: 'DB binding missing' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env?.BETTER_AUTH_SECRET) {
    return new Response(JSON.stringify({ error: 'BETTER_AUTH_SECRET missing' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let req = request;
  if (BASE) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(BASE)) {
      url.pathname = url.pathname.slice(BASE.length) || '/';
      req = new Request(url.toString(), request);
    }
  }

  try {
    const auth = getAuth(env);
    return await auth.handler(req);
  } catch (err) {
    console.error('[auth]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET = handle;
export const POST = handle;
