# Webflow Marketing Content Manager

Webapp para administrar las colecciones CMS de Webflow (cupones, filtros de cupones, hero banners, blog, comercios destacados), sincronizar colecciones desde Google Sheets/CSV (Benefits, Merchants, Longtail Sliders, Comercios destacados) y archivos CSV de banners (Ad Banners, Offerwall, Hero Banners) con UI orientada a usuarios no técnicos, conversión automática a WEBP y bitácora de acciones. Se despliega en Webflow Cloud (Cloudflare Workers).

## Funcionalidades

- **Gestión de colecciones CMS**: alta, edición, duplicado y borrado de cupones, filtros de cupones, hero banners y comercios destacados por categoría, con filtros y validación por formulario.
- **Blog | Posts** (colección en un workspace de Webflow distinto — "Cash"): flujo *draft-first* (crear/editar como borrador, publicar aparte) con slug auto-generado y de solo lectura, tiempo de lectura auto-calculado desde el contenido, selectores con búsqueda para las 6 colecciones referenciadas (categoría, subcategoría, autor, disclaimer, breadcrumbs, featured reviews, CTA) y editor de contenido enriquecido que admite insertar imágenes por subida (convertidas a WEBP) o por URL externa. También admite **embeds de Instagram (post/reel/tv), YouTube y Vimeo** (botón «▶ embed» o pegando el iframe/blockquote en modo HTML): se insertan como `<iframe>` y cualquier otro iframe fuera de esos hosts (solo `https`) se descarta. Un `blockquote` de Instagram se convierte a iframe porque Webflow elimina su `<script>`. La barra de herramientas del editor es *sticky* al hacer scroll.
  - Soporta **múltiples workspaces de Webflow**: cada colección declara su `workspace` en [src/lib/config/sites.ts](src/lib/config/sites.ts) y el cliente API resuelve el token correspondiente (`WEBFLOW_TOKEN` o `WEBFLOW_TOKEN_CASH`) en [src/lib/webflow/index.ts](src/lib/webflow/index.ts).
- **Subida de imágenes**: conversión automática a WEBP en el edge; soporta subir varias imágenes a la vez.
- **Directorio de comercios** (solo super-admin): catálogo interno de comercios (ID de organización, nombre y logo). El registro vive en D1 y el logo se hospeda como asset de Webflow. Alimenta el selector de logos del formulario de cupón para reutilizar logotipos sin volver a subirlos.
  - En el cupón el logo se guarda como *snapshot* (`{url, alt}`): editar o borrar un comercio no altera los cupones existentes ni elimina assets de Webflow.
- **Publicación de sitio** (admin y super-admin): desde cada colección, un botón flotante despliega opciones para publicar el sitio de Webflow a **staging** (subdominio `.webflow.io`) o a **producción** (dominios personalizados adjuntos, resueltos vía API). Evita tener que entrar a Webflow a publicar manualmente.
  - La publicación es **a nivel de sitio** (siteId): las colecciones que comparten sitio publican lo mismo, e incluye cualquier cambio pendiente en staging (incluido el Designer). Webflow limita a ~1 publicación por minuto.
- **Control de acceso por roles**: `super-admin` (acceso total + gestión de usuarios y comercios), `admin` (todas las secciones de contenido + publicación) y `editor` (limitado a secciones asignadas). Ver [src/lib/authz.ts](src/lib/authz.ts).
- **Gestión de usuarios** (solo super-admin): alta de usuarios con contraseña temporal, cambio de rol/secciones y recuperación de contraseña (contraseña temporal o enlace de un solo uso).
- **Sincronización de Benefits desde Google Sheets** (admin y super-admin): la colección "Benefit x merchants (Landing)" se actualiza desde una fuente de verdad en Google Sheets. Un Apps Script extrae las promociones (cashback y cupón) y las **envía** (push) a `POST /api/benefits/ingest` (protegido con un secreto compartido); la plataforma guarda el snapshot mensual en D1. La vista de Sincronización hace un **diff por `merchant-id`** contra Webflow (Nuevo / Cambiado / Sin cambios / Fuera de fuente / Sin landing), permite revisar campo por campo, seleccionar y aplicar.
  - Se usa **PATCH parcial**: el sync solo administra los bloques de cupón y cashback (y sus switches); nunca toca la promoción especial ni la referencia a landing existente. Los merchants ausentes del mes se apagan (soft-off). Aplica en *staging* y se publica con el control de publicación.
  - **Integración con Tiendas**: un merchant sin item en Benefits solo se crea como "Nuevo" si tiene landing en la colección Tiendas (por `merchant-id`); el item copia nombre/slug de la Tienda, se enlaza a ella y se escribe la referencia de vuelta en la Tienda. Sin landing queda como "Sin landing" y no se crea. Como Tiendas tiene miles de items, la UI la lee por tramos vía `GET /api/benefits/tiendas`.
  - Las llamadas a Webflow tienen **reintentos con manejo de rate limit (429 / `Retry-After`)**, acotados para no exceder el timeout (~20 s) de Webflow Cloud.
- **Sincronización de Merchants desde CSV** (admin y super-admin, `/merchants/sync`): cada fila del CSV trae su acción (Alta / Actualización / Baja). Se valida contra Webflow, se previsualiza el diff y se aplica. Una Baja elimina primero las landings de "Tiendas" que referencian al merchant. Solo escribe los campos que administra (nombre, categoría, tipo de tienda, sitio web, mapa); el slug se genera con `slugify`.
  - Para no exceder el timeout (~20 s) de Webflow Cloud, la lectura de colecciones grandes (Merchants/Tiendas) pagina en paralelo (4 páginas a la vez) y la aplicación de cambios se envía **por lotes de 10 merchants**, con progreso en el toast; si un lote falla se informa cuántos se aplicaron y basta re-previsualizar el CSV para ver lo pendiente.
- **Sincronización de Longtail Sliders y Comercios destacados por categoría desde CSV** (admin y super-admin, `/longtail-sliders/sync` y `/featured-merchants/sync`): a diferencia de los anteriores, cada sync **reemplaza por completo** la colección (se borran todos los items y se recrean desde el CSV). Se valida cada fila (merchant existente, opciones válidas, slugs únicos), se previsualiza y se aplica; el CSV admite arrastrar y soltar. En Comercios destacados el campo `orden` se renumera 1..N por categoría.
- **Bitácora de acciones**: journal append-only de todo el CRUD y las publicaciones (crear/editar/borrar/publish) con filtros por usuario, acción, colección y fecha.
- **UX de confirmaciones y avisos**: las acciones destructivas usan un diálogo de confirmación modal (`ConfirmDialog`); los resultados y estados se notifican con toasts (`sonner`).
- **Módulos CSV** ([src/components/dashboard/CsvCollectionPage.tsx](src/components/dashboard/CsvCollectionPage.tsx)): para contenido que vive en archivos CSV en S3 (sin acceso de escritura directo), un motor genérico reutilizable ofrece el flujo **subir → editar → descargar**: se sube el CSV, se valida su estructura (columnas exactas) y cada fila (Zod) antes de habilitar la edición, se edita con la misma UI de tarjetas/formulario que el resto de colecciones (todo en el cliente, sin llamadas al backend) y se descarga el archivo regenerado para volver a subirlo a S3 a mano. Incluye 3 colecciones:
  - **Ad Banners** (`ads.csv`) — banners de anuncios con vigencia y segmento de usuario (hora de Ciudad de México).
  - **Offerwall** / *Pestaña Explorar* (`hero_banners.csv`) — banners del offerwall con múltiples merchants.
  - **Hero Banners** / *Pestaña inicio* (`hero_banners.csv`) — banners de inicio con descuento/cashback, cupón y fechas de vigencia en formato de fecha simple (sin hora).
  - El nombre del archivo de descarga es **fijo por colección** (no depende del nombre del archivo subido), configurado en [src/lib/config/csvCollections.ts](src/lib/config/csvCollections.ts) — Offerwall y Hero Banners comparten intencionalmente el mismo nombre (`hero_banners.csv`) porque así lo espera la lógica de S3 consumidora.
  - Filtros de vista (vigencia y segmento) y **búsqueda de texto libre** sobre la lista, sin afectar el CSV exportado — siempre se descargan todos los items.
  - **Selección múltiple y borrado en lote** de filas, y **reordenamiento por drag-and-drop** (Ad Banners y Offerwall; el orden de las filas se refleja en el CSV descargado).
  - La subida del CSV admite arrastrar y soltar; Hero Banners (inicio) valida el `campaign_id` y ofrece plantillas.
  - Los campos de fecha/hora de Ad Banners y Offerwall se interpretan y convierten siempre en hora de **Ciudad de México** ([src/lib/datetime.ts](src/lib/datetime.ts)), sin importar la zona horaria del navegador de quien edita.

## Stack

- Astro 5 + React 19 + `@astrojs/cloudflare`
- Cloudflare D1 (SQLite edge) + Drizzle ORM
- Better Auth (sesiones cookie HttpOnly)
- `@cf-wasm/photon` (conversión WEBP en Workers)
- TipTap (WYSIWYG para RichText; incluye `@tiptap/extension-image` y una extensión propia de embeds basada en `@tiptap/core` para el editor de contenido del blog)
- react-hook-form + Zod
- TanStack Query + Axios
- papaparse (parseo/generación de CSV en el cliente)
- @dnd-kit (drag-and-drop para reordenar filas CSV)
- sonner (toasts)
- SCSS + PNPM + TypeScript estricto

## Requisitos previos

- Node 20+ y PNPM 11+
- Cuenta Cloudflare con wrangler autenticado (`pnpm wrangler login`)
- Token de Webflow API con scopes CMS + Assets + Sites (publicación) en los sitios del workspace principal
- Token de Webflow API adicional para el workspace **Cash** (colección de Blog Posts y sus 6 colecciones referenciadas)

## Setup local

```bash
pnpm install

# Modern Web Guidance (skills para AI agents)
npx modern-web-guidance@latest install

# Provisiona D1 local
pnpm wrangler d1 create web_marketing_db
# → en local no hace falta tocar wrangler.json; en Webflow Cloud el database_id
#   real lo inyecta la plataforma (en el repo es un placeholder)

pnpm db:generate
pnpm db:migrate:local

# Variables locales: copiar .dev.vars.example a .dev.vars y llenar
cp .dev.vars.example .dev.vars

pnpm dev
```

## Configuración inicial

1. Reemplaza en [src/lib/config/sites.ts](src/lib/config/sites.ts) los placeholders `REPLACE_WITH_SITE_ID_A` / `REPLACE_WITH_SITE_ID_B` con los `siteId` reales de Webflow.
2. En [wrangler.json](wrangler.json) el `database_id` de D1 es un placeholder (`placeholder-webflow-generates-this`): Webflow Cloud provee la base real en el deploy.
3. Sube secretos a Workers / variables de entorno de Webflow Cloud (no van al repo):
   ```bash
   pnpm wrangler secret put WEBFLOW_TOKEN
   pnpm wrangler secret put WEBFLOW_TOKEN_CASH  # workspace "Cash" (Blog Posts)
   pnpm wrangler secret put BETTER_AUTH_SECRET
   pnpm wrangler secret put BETTER_AUTH_URL
   pnpm wrangler secret put BENEFITS_INGEST_SECRET  # secreto compartido con el Apps Script de Benefits
   ```
   `BENEFITS_INGEST_SECRET` debe tener el **mismo valor** que la Script Property del Apps Script que envía las promociones. En local va en `.dev.vars`.

## Seguridad y Privacidad

El proyecto está configurado para rechazar indexación por buscadores:
- **robots.txt**: Bloquea a todos los crawlers (`Disallow: /`)
- **Meta tags**: Incluye `noindex, nofollow` en todas las páginas
- **HTTP headers**: Envía `X-Robots-Tag: noindex, nofollow` desde Cloudflare Workers

Requiere autenticación en todas las páginas excepto `/login` y `/api/auth` (ver [src/middleware.ts](src/middleware.ts)).

## Despliegue a Webflow Cloud

Las migraciones de D1 (`drizzle/migrations`) se aplican automáticamente en el deploy de Webflow Cloud; `pnpm db:migrate:remote` no funciona contra el remoto porque el `database_id` del repo es un placeholder. Webflow Cloud usa `npm install` (no pnpm), así que conviene verificar que `npm install` resuelva igual antes de hacer push.

```bash
pnpm build
pnpm deploy   # build + wrangler deploy (manual); en Webflow Cloud el deploy corre al hacer push
```

## Estructura

- `src/pages/` — páginas Astro y rutas API (`api/benefits`, `api/merchant-sync`, `api/longtail-sliders`, `api/featured-merchants`, `api/collections`, `api/admin`, …)
- `src/components/dashboard/` — páginas React de colecciones, módulos CSV y vistas de sincronización
- `src/lib/config/` — registro de colecciones Webflow ([sites.ts](src/lib/config/sites.ts)) y módulos CSV ([csvCollections.ts](src/lib/config/csvCollections.ts))
- `src/lib/csv-modules/` — esquemas y (de)serialización de cada CSV
- `src/lib/{benefits,merchant-sync,longtail-sliders,featured-merchants}/` — motores puros de diff/validación (con tests Vitest) y acceso a Webflow
- `src/lib/db/` + `drizzle/migrations/` — esquema D1 y migraciones

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
