/**
 * Browser-side API client for talking to our own Astro endpoints.
 */
import axios from 'axios';
import { withBase } from '@lib/base-path';

export const api = axios.create({ baseURL: withBase('api'), withCredentials: true });

export interface WebflowItem<T = Record<string, unknown>> {
  id: string;
  lastUpdated?: string;
  lastPublished?: string | null;
  isDraft?: boolean;
  fieldData: T & { name: string; slug: string };
}

export interface WebflowListResponse<T = Record<string, unknown>> {
  items: WebflowItem<T>[];
  pagination: { limit: number; offset: number; total: number };
  /** Set when the collection was too large to fetch in full — the list is a
   *  partial view, so client-side sorting and filtering are incomplete. */
  truncated?: boolean;
}

/**
 * Every item in the collection. Sending no limit/offset makes the API page
 * through Webflow server-side — the UI sorts and filters client-side, so it
 * needs the complete set.
 */
export async function listItems<T = Record<string, unknown>>(collectionId: string) {
  const { data } = await api.get<WebflowListResponse<T>>(
    `/collections/${collectionId}/items`,
  );
  return data;
}

export async function getItem<T = Record<string, unknown>>(
  collectionId: string,
  itemId: string,
) {
  const { data } = await api.get<WebflowItem<T>>(
    `/collections/${collectionId}/items/${itemId}`,
  );
  return data;
}

export async function createItem<T = Record<string, unknown>>(
  collectionId: string,
  fieldData: T & { name: string; slug: string },
  publish = true,
) {
  const { data } = await api.post<WebflowItem<T>>(
    `/collections/${collectionId}/items`,
    { fieldData, publish },
  );
  return data;
}

export async function updateItem<T = Record<string, unknown>>(
  collectionId: string,
  itemId: string,
  fieldData: Partial<T> & { name?: string; slug?: string },
  publish = true,
) {
  const { data } = await api.patch<WebflowItem<T>>(
    `/collections/${collectionId}/items/${itemId}`,
    { fieldData, publish },
  );
  return data;
}

export async function deleteItem(collectionId: string, itemId: string) {
  await api.delete(`/collections/${collectionId}/items/${itemId}`);
}

export interface ReferenceOption {
  id: string;
  name: string;
}

/** List `{ id, name }` options for a blog-referenced collection (for pickers). */
export async function listReferenceItems(collectionId: string) {
  const { data } = await api.get<{ options: ReferenceOption[] }>(
    `/collections/${collectionId}/reference-items`,
  );
  return data.options;
}

export interface BulkDeleteResult {
  deleted: string[];
  deletedCount: number;
  /** How many of the deleted items were also unpublished from the live site. */
  unpublished: number;
  /** Items that were drafts, so there was nothing to unpublish. */
  skippedDrafts: number;
  missing?: string[];
  unpublishFailures?: { ids: string[]; error: string }[];
  deleteFailures?: { ids: string[]; error: string }[];
}

/** Unpublish + delete several items in two bulk Webflow calls per 100 items. */
export async function bulkDeleteItems(collectionId: string, itemIds: string[]) {
  const { data } = await api.post<BulkDeleteResult>(
    `/collections/${collectionId}/items/bulk-delete`,
    { itemIds },
  );
  return data;
}

export interface SitePublishStatus {
  stagingPublishedAt: string | null;
  productionPublishedAt: string | null;
}

/** Last time this site was actually published (staging/production), per our audit log. */
export async function getSitePublishStatus(siteId: string) {
  const { data } = await api.get<SitePublishStatus>(`/sites/${siteId}/publish-status`);
  return data;
}
