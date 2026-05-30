/**
 * Webflow Data API v2 — CMS collection items CRUD.
 * https://developers.webflow.com/data/reference/cms/collection-items
 */
import type { WebflowClient } from './client';

export interface CollectionItem<TFields = Record<string, unknown>> {
  id: string;
  cmsLocaleId?: string;
  lastPublished?: string | null;
  lastUpdated?: string;
  createdOn?: string;
  isArchived?: boolean;
  isDraft?: boolean;
  fieldData: TFields & { name: string; slug: string };
}

export interface ListItemsResponse<TFields = Record<string, unknown>> {
  items: CollectionItem<TFields>[];
  pagination: { limit: number; offset: number; total: number };
}

export interface ListItemsOpts {
  limit?: number; // max 100
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function createCollectionsApi(client: WebflowClient) {
  return {
    list<T = Record<string, unknown>>(collectionId: string, opts: ListItemsOpts = {}) {
      return client.request<ListItemsResponse<T>>(`/collections/${collectionId}/items`, {
        query: { ...opts },
      });
    },

    get<T = Record<string, unknown>>(collectionId: string, itemId: string) {
      return client.request<CollectionItem<T>>(`/collections/${collectionId}/items/${itemId}`);
    },

    create<T = Record<string, unknown>>(
      collectionId: string,
      fieldData: T & { name: string; slug: string },
      opts: { isDraft?: boolean; publish?: boolean } = {},
    ) {
      const endpoint = opts.publish
        ? `/collections/${collectionId}/items/live`
        : `/collections/${collectionId}/items`;
      return client.request<CollectionItem<T>>(endpoint, {
        method: 'POST',
        body: { isArchived: false, isDraft: opts.isDraft ?? false, fieldData },
      });
    },

    update<T = Record<string, unknown>>(
      collectionId: string,
      itemId: string,
      fieldData: Partial<T> & { name?: string; slug?: string },
      opts: { publish?: boolean } = {},
    ) {
      const endpoint = opts.publish
        ? `/collections/${collectionId}/items/${itemId}/live`
        : `/collections/${collectionId}/items/${itemId}`;
      return client.request<CollectionItem<T>>(endpoint, {
        method: 'PATCH',
        body: { fieldData },
      });
    },

    remove(collectionId: string, itemId: string) {
      return client.request<void>(`/collections/${collectionId}/items/${itemId}`, {
        method: 'DELETE',
      });
    },

    publish(collectionId: string, itemIds: string[]) {
      return client.request<{ publishedItemIds: string[] }>(
        `/collections/${collectionId}/items/publish`,
        { method: 'POST', body: { itemIds } },
      );
    },

    getSchema(collectionId: string) {
      return client.request<{
        id: string;
        displayName: string;
        slug: string;
        fields: Array<{ id: string; slug: string; type: string; displayName: string }>;
      }>(`/collections/${collectionId}`);
    },
  };
}

export type CollectionsApi = ReturnType<typeof createCollectionsApi>;
