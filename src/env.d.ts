/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  DB: D1Database;
  WEBFLOW_TOKEN: string;
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
