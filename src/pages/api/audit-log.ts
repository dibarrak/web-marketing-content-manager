/**
 * GET /api/audit-log
 *   ?user=<email substring>
 *   &action=create|update|delete
 *   &collectionId=<id>
 *   &since=<ISO date>
 *   &until=<ISO date>
 *   &limit=<int, default 100, max 500>
 *   &offset=<int>
 *
 * Returns: { rows: AuditRow[], total: number }
 */
import type { APIRoute } from 'astro';
import { and, desc, eq, gte, like, lte, sql } from 'drizzle-orm';
import { getDb, schema } from '@lib/db';
import { canAccessSection } from '@lib/authz';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (!canAccessSection(user, 'auditLog')) return new Response('Forbidden', { status: 403 });

  const url = new URL(request.url);
  const userFilter = url.searchParams.get('user') ?? '';
  const action = url.searchParams.get('action');
  const collectionId = url.searchParams.get('collectionId');
  const since = url.searchParams.get('since');
  const until = url.searchParams.get('until');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);

  const conditions = [];
  if (userFilter) conditions.push(like(schema.auditLog.userEmail, `%${userFilter}%`));
  if (action === 'create' || action === 'update' || action === 'delete') {
    conditions.push(eq(schema.auditLog.action, action));
  }
  if (collectionId) conditions.push(eq(schema.auditLog.collectionId, collectionId));
  if (since) {
    const ts = new Date(since);
    if (!Number.isNaN(ts.getTime())) conditions.push(gte(schema.auditLog.ts, ts));
  }
  if (until) {
    const ts = new Date(until);
    if (!Number.isNaN(ts.getTime())) conditions.push(lte(schema.auditLog.ts, ts));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const db = getDb(locals.runtime.env);

  const [rows, [{ count }]] = await Promise.all([
    db
      .select()
      .from(schema.auditLog)
      .where(where)
      .orderBy(desc(schema.auditLog.ts))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)`.as('count') })
      .from(schema.auditLog)
      .where(where),
  ]);

  return Response.json({ rows, total: Number(count) });
};
