import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

const stylesDir = fileURLToPath(new URL('./src/styles', import.meta.url));

// better-auth bundles @better-auth/kysely-adapter which imports internal kysely
// symbols (DEFAULT_MIGRATION_TABLE, DEFAULT_MIGRATION_LOCK_TABLE) that kysely
// exports from its sub-path but not from its main index. This plugin appends
// those missing re-exports to kysely's main bundle so Rollup's static analysis
// resolves cleanly (the kysely adapter is never called at runtime since the
// project uses drizzleAdapter).
const kyselyShimPlugin = {
  name: 'kysely-migration-shim',
  transform(code, id) {
    if (id.includes('/kysely/dist/index.js') && !id.includes('kysely-shim')) {
      return {
        code:
          code +
          `\nexport { DEFAULT_MIGRATION_TABLE, DEFAULT_MIGRATION_LOCK_TABLE } from './migration/migrator.js';\n`,
        map: null,
      };
    }
  },
};

export default defineConfig({
  output: 'server',
  base: process.env.COSMIC_MOUNT_PATH || '/',
  // Behind Webflow Cloud's reverse proxy the Worker sees an internal Host
  // (*.cosmic.webflow.services) that never matches the public Origin
  // (kueskipay.webflow.io). Astro's default CSRF check then rejects every
  // form-encoded POST (e.g. multipart image uploads) with
  // "Cross-site POST form submissions are forbidden". Session auth already
  // guards these endpoints, so we disable the origin check.
  security: { checkOrigin: false },
  adapter: cloudflare({
    platformProxy: { enabled: true },
    imageService: 'compile',
  }),
  integrations: [react()],
  vite: {
    plugins: [kyselyShimPlugin],
    css: {
      preprocessorOptions: {
        scss: {
          loadPaths: [stylesDir],
          additionalData: `@use 'tokens' as *;\n@use 'mixins' as *;\n`,
        },
      },
    },
    ssr: {
      external: ['node:buffer', 'node:async_hooks', 'sharp'],
    },
  },
});
