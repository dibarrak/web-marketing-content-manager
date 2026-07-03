import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Users — managed by Better Auth.
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  name: text('name').notNull(),
  image: text('image'),
  role: text('role').notNull().default('editor'), // 'super-admin' | 'admin' | 'editor'
  // JSON array of CollectionKey strings an editor may access (e.g. ["coupons"]).
  // null = full access — used for super-admin/admin (role grants everything).
  allowedSections: text('allowed_sections'),
  // Fields required by the Better Auth `admin` plugin.
  banned: integer('banned', { mode: 'boolean' }).default(false),
  banReason: text('ban_reason'),
  banExpires: integer('ban_expires', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Sessions — managed by Better Auth.
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  // Set by the Better Auth `admin` plugin when an admin impersonates a user.
  impersonatedBy: text('impersonated_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Accounts — Better Auth credentials/oauth links.
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const verifications = sqliteTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// Password reset tokens — for the super-admin "generate reset link" flow
// (Modo B). The plaintext token lives only in the shared URL; we store its
// SHA-256 hash. Single-use (usedAt) and time-limited (expiresAt).
export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Merchants — internal directory of partner merchants, managed by super-admins.
// The record lives here in D1; the logo itself is a Webflow asset (we store its
// hosted URL + asset id). Coupons reference a merchant's logo as a snapshot
// ({url, alt}), so editing/deleting a merchant never mutates existing coupons.
export const merchants = sqliteTable('merchants', {
  id: text('id').primaryKey(),
  // Organization-generated identifier for the merchant (unique).
  merchantId: text('merchant_id').notNull().unique(),
  name: text('name').notNull(),
  // Hosted URL of the logo asset in Webflow.
  logoUrl: text('logo_url').notNull(),
  // Webflow asset id — kept for future dedup/cleanup tooling.
  logoAssetId: text('logo_asset_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Audit log — append-only journal of every CRUD action.
export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  userEmail: text('user_email').notNull(),
  action: text('action', { enum: ['create', 'update', 'delete', 'publish'] }).notNull(),
  siteId: text('site_id').notNull(),
  collectionId: text('collection_id').notNull(),
  itemId: text('item_id'),
  itemSlug: text('item_slug'),
  diffJson: text('diff_json'),
  ts: integer('ts', { mode: 'timestamp' }).notNull(),
});
