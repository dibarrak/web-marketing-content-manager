/**
 * Webflow Data API v2 — site publishing.
 * https://developers.webflow.com/data/reference/sites/publish
 * https://developers.webflow.com/data/reference/sites/custom-domains/list
 */
import type { WebflowClient } from './client';

export interface CustomDomain {
  id: string;
  url: string;
  lastPublished?: string | null;
}

export interface PublishResult {
  customDomains?: CustomDomain[];
  publishToWebflowSubdomain?: boolean;
}

export function createSitesApi(client: WebflowClient) {
  return {
    /** List the custom (production) domains attached to a site. */
    async getCustomDomains(siteId: string): Promise<CustomDomain[]> {
      const data = await client.request<{ customDomains: CustomDomain[] }>(
        `/sites/${siteId}/custom_domains`,
      );
      return data.customDomains ?? [];
    },

    /**
     * Publish a site. Provide `toStaging` to push to the .webflow.io subdomain
     * and/or `customDomainIds` to push to production domains. Webflow requires
     * at least one target. Rate-limited to ~1 successful publish per minute.
     */
    publish(
      siteId: string,
      { toStaging, customDomainIds }: { toStaging?: boolean; customDomainIds?: string[] },
    ) {
      const body: Record<string, unknown> = {};
      if (toStaging) body.publishToWebflowSubdomain = true;
      if (customDomainIds && customDomainIds.length > 0)
        body.customDomains = customDomainIds;
      return client.request<PublishResult>(`/sites/${siteId}/publish`, {
        method: 'POST',
        body,
      });
    },
  };
}

export type SitesApi = ReturnType<typeof createSitesApi>;
