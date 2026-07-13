/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  DB: D1Database;
  WEBFLOW_TOKEN: string;
  /**
   * Webflow API token for the "Cash" workspace (separate from the primary
   * workspace token above). Used by collections whose `workspace` is 'cash'
   * — currently the Blog Posts collection and its referenced collections.
   * Loaded as a Worker secret, never committed.
   */
  WEBFLOW_TOKEN_CASH: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  PUBLIC_APP_NAME: string;
  /**
   * Shared secret validated by POST /api/benefits/ingest — the Apps Script
   * extractor sends it so it can push promo snapshots without a user session.
   */
  BENEFITS_INGEST_SECRET: string;
}

declare namespace App {
  interface Locals extends Runtime {
    user?: {
      id: string;
      email: string;
      name: string;
      role: string;
      // Parsed list of section keys for editors; null = full access.
      allowedSections: string[] | null;
    };
  }
}
