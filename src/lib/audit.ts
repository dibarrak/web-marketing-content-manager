import { getDb, schema } from './db';

const newId = () => crypto.randomUUID();

type Action = 'create' | 'update' | 'delete';

export interface AuditEntry {
  userId: string;
  userEmail: string;
  action: Action;
  siteId: string;
  collectionId: string;
  itemId?: string;
  itemSlug?: string;
  diff?: unknown;
}

export async function logAudit(env: Env, entry: AuditEntry): Promise<void> {
  const db = getDb(env);
  await db.insert(schema.auditLog).values({
    id: newId(),
    userId: entry.userId,
    userEmail: entry.userEmail,
    action: entry.action,
    siteId: entry.siteId,
    collectionId: entry.collectionId,
    itemId: entry.itemId,
    itemSlug: entry.itemSlug,
    diffJson: entry.diff ? JSON.stringify(entry.diff) : null,
    ts: new Date(),
  });
}
