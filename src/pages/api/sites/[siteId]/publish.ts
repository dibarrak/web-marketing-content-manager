/**
 * POST /api/sites/:siteId/publish — publish a whole Webflow site.
 * Body: { target: 'staging' | 'production' }
 *  - staging    → publishes to the .webflow.io subdomain
 *  - production → publishes to every custom domain attached to the site
 *
 * Restricted to admin & super-admin. Rate-limited by Webflow to ~1/min per site.
 */
import type { APIRoute } from 'astro';
import { getWebflow } from '@lib/webflow';
import { webflowErrorResponse } from '@lib/webflow/error-response';
import { isKnownSiteId } from '@lib/config/sites';
import { isAdmin } from '@lib/authz';
import { logAudit } from '@lib/audit';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!isAdmin(user)) return new Response('Forbidden', { status: 403 });

  const siteId = params.siteId!;
  if (!isKnownSiteId(siteId))
    return Response.json({ error: 'Unknown site' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    target?: 'staging' | 'production';
  } | null;
  const target = body?.target;
  if (target !== 'staging' && target !== 'production') {
    return Response.json({ error: "target must be 'staging' or 'production'" }, { status: 400 });
  }

  try {
    const wf = getWebflow(locals.runtime.env);

    let publishedDomains: string[] = [];
    if (target === 'production') {
      const domains = await wf.sites.getCustomDomains(siteId);
      if (domains.length === 0) {
        return Response.json(
          { error: 'El sitio no tiene dominios de producción configurados en Webflow.' },
          { status: 409 },
        );
      }
      await wf.sites.publish(siteId, { customDomainIds: domains.map((d) => d.id) });
      publishedDomains = domains.map((d) => d.url);
    } else {
      await wf.sites.publish(siteId, { toStaging: true });
      publishedDomains = ['webflow.io (staging)'];
    }

    await logAudit(locals.runtime.env, {
      userId: user.id,
      userEmail: user.email,
      action: 'publish',
      siteId,
      collectionId: 'site-publish',
      diff: { target, domains: publishedDomains },
    });

    return Response.json({ ok: true, target, domains: publishedDomains });
  } catch (err) {
    return webflowErrorResponse(err);
  }
};
