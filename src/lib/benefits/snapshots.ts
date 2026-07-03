/**
 * Persistence for benefits promo snapshots pushed by the Apps Script extractor.
 * One row per monthly tab; the latest push overwrites it. Read by the sync
 * preview/apply flow.
 */
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@lib/db';
import type { WebAppResponse } from './sync';

export interface SnapshotPayload {
  cashback?: WebAppResponse['cashback'];
  cupon?: WebAppResponse['cupon'];
}

/** Upsert the snapshot for a month. */
export async function saveSnapshot(
  env: Env,
  month: string,
  payload: SnapshotPayload,
  pushedBy: string | null,
): Promise<void> {
  const db = getDb(env);
  const row = {
    month,
    dataJson: JSON.stringify({ cashback: payload.cashback ?? [], cupon: payload.cupon ?? [] }),
    pushedBy,
    updatedAt: new Date(),
  };
  await db
    .insert(schema.benefitsSnapshots)
    .values(row)
    .onConflictDoUpdate({
      target: schema.benefitsSnapshots.month,
      set: { dataJson: row.dataJson, pushedBy: row.pushedBy, updatedAt: row.updatedAt },
    });
}

export interface MonthInfo {
  month: string;
  updatedAt: string;
}

/** List months that have a stored snapshot, newest push first. */
export async function listMonths(env: Env): Promise<MonthInfo[]> {
  const db = getDb(env);
  const rows = await db
    .select({ month: schema.benefitsSnapshots.month, updatedAt: schema.benefitsSnapshots.updatedAt })
    .from(schema.benefitsSnapshots)
    .orderBy(desc(schema.benefitsSnapshots.updatedAt));
  return rows.map((r) => ({ month: r.month, updatedAt: r.updatedAt.toISOString() }));
}

/** Read a month's snapshot as a WebAppResponse-shaped object, or null. */
export async function getSnapshot(env: Env, month: string): Promise<WebAppResponse | null> {
  const db = getDb(env);
  const [row] = await db
    .select()
    .from(schema.benefitsSnapshots)
    .where(eq(schema.benefitsSnapshots.month, month))
    .limit(1);
  if (!row) return null;
  const parsed = JSON.parse(row.dataJson) as SnapshotPayload;
  return { ok: true, month, cashback: parsed.cashback ?? [], cupon: parsed.cupon ?? [] };
}
