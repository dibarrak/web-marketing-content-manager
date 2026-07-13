import { createWebflowClient } from './client';
import { createCollectionsApi } from './collections';
import { createAssetsApi } from './assets';
import { createSitesApi } from './sites';
import type { Workspace } from '@lib/config/sites';

/** Resolve the API token for a given workspace. Defaults to the primary one. */
function tokenFor(env: Env, workspace: Workspace = 'default'): string {
  return workspace === 'cash' ? env.WEBFLOW_TOKEN_CASH : env.WEBFLOW_TOKEN;
}

export function getWebflow(env: Env, workspace: Workspace = 'default') {
  const client = createWebflowClient(tokenFor(env, workspace));
  return {
    collections: createCollectionsApi(client),
    assets: createAssetsApi(client),
    sites: createSitesApi(client),
  };
}

export type WebflowApi = ReturnType<typeof getWebflow>;
export { WebflowApiError } from './client';
