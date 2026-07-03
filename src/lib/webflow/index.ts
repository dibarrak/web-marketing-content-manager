import { createWebflowClient } from './client';
import { createCollectionsApi } from './collections';
import { createAssetsApi } from './assets';
import { createSitesApi } from './sites';

export function getWebflow(env: Env) {
  const client = createWebflowClient(env.WEBFLOW_TOKEN);
  return {
    collections: createCollectionsApi(client),
    assets: createAssetsApi(client),
    sites: createSitesApi(client),
  };
}

export type WebflowApi = ReturnType<typeof getWebflow>;
export { WebflowApiError } from './client';
