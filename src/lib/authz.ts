/**
 * Authorization helpers — role tiers and per-section access control.
 *
 * Roles:
 *  - 'super-admin' — full access + user management + user creation.
 *  - 'admin'       — full access to all content sections (incl. audit log).
 *  - 'editor'      — access limited to the sections in `allowedSections`.
 *
 * Sections map 1:1 to the CMS collections plus the audit log. The audit log is
 * reserved for admin/super-admin and is NOT assignable to editors.
 */
import { COLLECTIONS, findCollectionById, type CollectionKey } from '@lib/config/sites';
import { CSV_COLLECTIONS, type CsvCollectionKey } from '@lib/config/csvCollections';

export type Role = 'super-admin' | 'admin' | 'editor';

/** Assignable roles, in display order. */
export const VALID_ROLES: Role[] = ['super-admin', 'admin', 'editor'];

/** Human-readable role names (es-MX). */
export const ROLE_LABELS: Record<Role, string> = {
  'super-admin': 'Super administrador',
  admin: 'Administrador',
  editor: 'Editor',
};

/** A grantable section: a collection key, a CSV module key, or the audit log. */
export type Section = CollectionKey | CsvCollectionKey | 'auditLog';

/** Minimal user shape needed for authorization checks. */
export interface AuthUser {
  role: string;
  /** Parsed list for editors; null = full access (admin/super-admin). */
  allowedSections?: readonly string[] | null;
}

const COLLECTION_KEYS = Object.keys(COLLECTIONS) as CollectionKey[];
const CSV_COLLECTION_KEYS = Object.keys(CSV_COLLECTIONS) as CsvCollectionKey[];

/** Every section in the app. */
export const ALL_SECTIONS: Section[] = [...COLLECTION_KEYS, ...CSV_COLLECTION_KEYS, 'auditLog'];

/** Sections a super-admin may grant to an editor (audit log excluded). */
export const EDITOR_ASSIGNABLE_SECTIONS: (CollectionKey | CsvCollectionKey)[] = [
  ...COLLECTION_KEYS,
  ...CSV_COLLECTION_KEYS,
];

export function isSuperAdmin(user?: AuthUser | null): boolean {
  return user?.role === 'super-admin';
}

export function isAdmin(user?: AuthUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'super-admin';
}

/** Whether `user` may access a given section. */
export function canAccessSection(user: AuthUser | null | undefined, section: Section): boolean {
  if (!user) return false;
  // super-admin & admin: full access to everything.
  if (user.role === 'super-admin' || user.role === 'admin') return true;
  // editor: the audit log is reserved for admin/super-admin.
  if (section === 'auditLog') return false;
  return (user.allowedSections ?? []).includes(section);
}

/** Whether `user` may access the collection identified by `collectionId`. */
export function canAccessCollection(
  user: AuthUser | null | undefined,
  collectionId: string,
): boolean {
  const collection = findCollectionById(collectionId);
  if (!collection) return false;
  return canAccessSection(user, collection.key);
}

/** List of sections `user` can actually reach (for filtering UI). */
export function accessibleSections(user: AuthUser | null | undefined): Section[] {
  return ALL_SECTIONS.filter((s) => canAccessSection(user, s));
}

/**
 * Keep only valid, known editor-assignable sections from arbitrary input
 * (parsed JSON, an array, etc.). Used by the admin write endpoints.
 */
export function sanitizeSections(input: unknown): string[] {
  const parsed = parseAllowedSections(input) ?? [];
  return parsed.filter((s) => (EDITOR_ASSIGNABLE_SECTIONS as string[]).includes(s));
}

/**
 * Normalize the raw `allowedSections` value (JSON string from the DB, an array,
 * or null) into a string[] | null. null means "full access".
 */
export function parseAllowedSections(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw === 'string') {
    if (raw.trim() === '') return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : null;
    } catch {
      return null;
    }
  }
  return null;
}
