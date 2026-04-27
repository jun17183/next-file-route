# next-file-route — basic example

Minimal Next.js 15 app exercising every public API of the library.

## Routes

| Path                 | Demonstrates |
|----------------------|--------------|
| `/`                  | `getNavTree`, `createMetadata`, declaration merging |
| `/about`             | static `createMetadata` |
| `/admin`             | `<Breadcrumb />`, `meta.roles` |
| `/admin/users`       | Zod search schema + `meta.roles` |
| `/admin/users/[id]`  | dynamic segment + RBAC inheritance |
| `/posts/[id]`        | dynamic segment + Zod search |
| `/products`          | `parseSearch` server function |

## Run it

```bash
npm install                # installs from the parent package via file:..
npm run sync               # generates .generated/manifest.mjs + routes.d.ts
npm run dev:webpack        # standard Next.js dev (webpack plugin auto-runs)
npm run dev:turbopack      # standalone watcher + next dev --turbopack
npm run build              # production build
```

> Next.js will generate `tsconfig.json` and `next-env.d.ts` on first dev run.

## Bundlers

- **Webpack** (`next dev` / `next build`): the `withFileRoute(...)` wrapper in
  `next.config.mjs` registers the plugin; no extra steps.
- **Turbopack** (`next dev --turbopack`): Next.js doesn't expose a Turbopack
  plugin API yet, so we run `next-file-route watch` in parallel. Both are
  combined in the `dev:turbopack` script via `&`.

## Auth placeholder

`app/admin/layout.tsx` calls `requireRoles({ ..., userRoles })` with a stubbed
`getCurrentUserRoles()`. Wire that to your real auth provider (NextAuth.js,
Clerk, custom session, etc.) — the library doesn't care where the roles come
from, only that you pass them in.
