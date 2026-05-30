import type { APIRoute } from 'astro';

export const prerender = false;

// Temporary diagnostic endpoint. Reports which bindings/secrets the Worker sees
// and which tables exist in the bound D1 database. Remove once auth works.
export const GET: APIRoute = async ({ locals }) => {
  const env = locals.runtime?.env as Env | undefined;

  const report: Record<string, unknown> = {
    hasRuntime: !!locals.runtime,
    hasDB: !!env?.DB,
    hasBetterAuthSecret: !!env?.BETTER_AUTH_SECRET,
    betterAuthUrl: env?.BETTER_AUTH_URL ?? null,
    hasWebflowToken: !!env?.WEBFLOW_TOKEN,
  };

  if (env?.DB) {
    try {
      const res = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      ).all();
      report.tables = res.results?.map((r) => (r as { name: string }).name) ?? [];
    } catch (err) {
      report.dbError = String(err);
    }
  }

  return new Response(JSON.stringify(report, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
