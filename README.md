# Webflow Marketing Content Manager

Webapp para administrar las colecciones CMS de Webflow (cupones, filtros de cupones, hero banners) con UI orientada a usuarios no técnicos, conversión automática a WEBP y bitácora de acciones. Se despliega en Webflow Cloud (Cloudflare Workers).

## Stack

- Astro 5 + React 18 + `@astrojs/cloudflare`
- Cloudflare D1 (SQLite edge) + Drizzle ORM
- Better Auth (sesiones cookie HttpOnly)
- `@cf-wasm/photon` (conversión WEBP en Workers)
- TipTap (WYSIWYG para RichText)
- react-hook-form + Zod
- TanStack Query + Axios
- SCSS + PNPM + TypeScript estricto

## Requisitos previos

- Node 20+ y PNPM 11+
- Cuenta Cloudflare con wrangler autenticado (`pnpm wrangler login`)
- Token de Webflow API con scope CMS + Assets en los dos sitios

## Setup local

```bash
pnpm install

# Modern Web Guidance (skills para AI agents)
npx modern-web-guidance@latest install

# Provisiona D1 local
pnpm wrangler d1 create web_marketing_db
# → copia el database_id devuelto a wrangler.toml

pnpm db:generate
pnpm db:migrate:local

# Variables locales: copiar .env.example a .env y llenar
cp .env.example .env

pnpm dev
```

## Configuración inicial

1. Reemplaza en [src/lib/config/sites.ts](src/lib/config/sites.ts) los placeholders `REPLACE_WITH_SITE_ID_A` / `REPLACE_WITH_SITE_ID_B` con los `siteId` reales de Webflow.
2. Reemplaza en [wrangler.toml](wrangler.toml) `REPLACE_WITH_REAL_D1_ID` con el ID devuelto por `wrangler d1 create`.
3. Sube secretos a Workers (no van al repo):
   ```bash
   pnpm wrangler secret put WEBFLOW_TOKEN
   pnpm wrangler secret put BETTER_AUTH_SECRET
   pnpm wrangler secret put BETTER_AUTH_URL
   ```

## Seguridad y Privacidad

El proyecto está configurado para rechazar indexación por buscadores:
- **robots.txt**: Bloquea a todos los crawlers (`Disallow: /`)
- **Meta tags**: Incluye `noindex, nofollow` en todas las páginas
- **HTTP headers**: Envía `X-Robots-Tag: noindex, nofollow` desde Cloudflare Workers

Requiere autenticación en todas las páginas excepto `/login` y `/api/auth` (ver [src/middleware.ts](src/middleware.ts)).

## Despliegue a Webflow Cloud

```bash
pnpm db:migrate:remote
pnpm deploy
```

## Estructura

Ver [el plan completo](../../.claude/plans/el-objetivo-de-esta-happy-kite.md) para arquitectura y milestones.

## Scripts

| Script | Propósito |
|---|---|
| `pnpm dev` | Astro dev server local |
| `pnpm preview` | Wrangler dev (simula Workers) |
| `pnpm build` | Build de producción |
| `pnpm deploy` | Build + deploy a Cloudflare |
| `pnpm typecheck` | TypeScript + astro check |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm test` | Vitest |
| `pnpm db:generate` | Genera migraciones Drizzle |
| `pnpm db:migrate:local` | Aplica migraciones a D1 local |
| `pnpm db:migrate:remote` | Aplica migraciones a D1 remoto |
