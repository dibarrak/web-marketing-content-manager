# Webflow Marketing Content Manager

Webapp para administrar las colecciones CMS de Webflow (cupones, filtros de cupones, hero banners) con UI orientada a usuarios no técnicos, conversión automática a WEBP y bitácora de acciones. Se despliega en Webflow Cloud (Cloudflare Workers).

## Funcionalidades

- **Gestión de colecciones CMS**: alta, edición, duplicado y borrado de cupones, filtros de cupones y hero banners, con filtros y validación por formulario.
- **Subida de imágenes**: conversión automática a WEBP en el edge; soporta subir varias imágenes a la vez.
- **Directorio de comercios** (solo super-admin): catálogo interno de comercios (ID de organización, nombre y logo). El registro vive en D1 y el logo se hospeda como asset de Webflow. Alimenta el selector de logos del formulario de cupón para reutilizar logotipos sin volver a subirlos.
  - En el cupón el logo se guarda como *snapshot* (`{url, alt}`): editar o borrar un comercio no altera los cupones existentes ni elimina assets de Webflow.
- **Publicación de sitio** (admin y super-admin): desde cada colección, un botón flotante despliega opciones para publicar el sitio de Webflow a **staging** (subdominio `.webflow.io`) o a **producción** (dominios personalizados adjuntos, resueltos vía API). Evita tener que entrar a Webflow a publicar manualmente.
  - La publicación es **a nivel de sitio** (siteId): las colecciones que comparten sitio publican lo mismo, e incluye cualquier cambio pendiente en staging (incluido el Designer). Webflow limita a ~1 publicación por minuto.
- **Control de acceso por roles**: `super-admin` (acceso total + gestión de usuarios y comercios), `admin` (todas las secciones de contenido + publicación) y `editor` (limitado a secciones asignadas). Ver [src/lib/authz.ts](src/lib/authz.ts).
- **Gestión de usuarios** (solo super-admin): alta de usuarios con contraseña temporal, cambio de rol/secciones y recuperación de contraseña (contraseña temporal o enlace de un solo uso).
- **Bitácora de acciones**: journal append-only de todo el CRUD y las publicaciones (crear/editar/borrar/publish) con filtros por usuario, acción, colección y fecha.
- **UX de confirmaciones y avisos**: las acciones destructivas usan un diálogo de confirmación modal (`ConfirmDialog`); los resultados y estados se notifican con toasts (`sonner`).

## Stack

- Astro 5 + React 19 + `@astrojs/cloudflare`
- Cloudflare D1 (SQLite edge) + Drizzle ORM
- Better Auth (sesiones cookie HttpOnly)
- `@cf-wasm/photon` (conversión WEBP en Workers)
- TipTap (WYSIWYG para RichText)
- react-hook-form + Zod
- TanStack Query + Axios
- sonner (toasts)
- SCSS + PNPM + TypeScript estricto

## Requisitos previos

- Node 20+ y PNPM 11+
- Cuenta Cloudflare con wrangler autenticado (`pnpm wrangler login`)
- Token de Webflow API con scopes CMS + Assets + Sites (publicación) en los dos sitios

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
