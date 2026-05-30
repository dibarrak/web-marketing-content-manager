# Project: web-marketing-content-manager

## Stack
- **Framework:** Astro 5 (SSR) + React 19 + TypeScript
- **Adapter:** `@astrojs/cloudflare` (deploys to Cloudflare Workers via Webflow Cloud)
- **Database:** Cloudflare D1 + Drizzle ORM
- **Auth:** better-auth
- **Package manager:** pnpm

## Dependency guidelines

Always use the **latest stable** version when adding or updating packages:
- Run `pnpm add <pkg>@latest` (or the equivalent) instead of accepting the default version.
- Before pinning a version range, check whether the installed version satisfies every peer dependency. Use `pnpm peers check` after installing.
- When upgrading a major version (e.g. React 18 → 19), verify that all packages in `dependencies` and `devDependencies` that list a `peerDependency` on that package support the new major.

## Deployment notes (Webflow Cloud)

Webflow Cloud runs `npm install` (not pnpm) and compiles with the `workerd` condition active.
- `react-dom/server` resolves to `react-dom/server.edge` under `workerd` — this export **only exists in react-dom ≥ 19**. Always keep React at v19+.
- Path aliases (`@layouts/*`, `@components/*`, etc.) must be declared in `tsconfig.json` `paths`. Astro reads them natively.
- The `pnpm-lock.yaml` is committed so local and CI resolutions match.
