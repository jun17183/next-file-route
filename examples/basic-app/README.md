# next-file-route — basic example

Minimal Next.js 15 app that declares route data with `route()` and reads it back.

## Routes

| Path                 | Demonstrates |
|----------------------|--------------|
| `/`                  | `getRoutes()` — renders the whole manifest |
| `/about`             | static `meta` + `generateMetadata` |
| `/admin`             | page without `route()`; data comes from `admin/layout.tsx` |
| `/admin/users`       | Zod search schema + `meta.roles` |
| `/admin/users/[id]`  | dynamic segment + `meta.roles` |
| `/posts/[id]`        | dynamic segment + Zod search |
| `/products`          | `parseSearch()` in a server component |

`app/layout.tsx` and `app/admin/layout.tsx` also call `route()` to provide default metadata.

## Run it

```bash
npm install                # installs from the parent package via file:../..
npm run sync               # generates the manifest + routes.d.ts
npm run dev:webpack        # standard Next.js dev (webpack plugin auto-runs)
npm run dev:turbopack      # standalone watcher + next dev --turbopack
npm run build              # sync + production build
npm run inspect            # print the current manifest as JSON
```

Build the library in the repo root (`npm run build`) before installing, since the example depends on its `dist/`.

> Next.js will generate `tsconfig.json` and `next-env.d.ts` on first dev run.

## Bundlers

- **Webpack** (`next dev` / `next build`): the `withFileRoute(...)` wrapper in
  `next.config.mjs` registers the plugin; no extra steps.
- **Turbopack** (`next dev --turbopack`): Next.js doesn't expose a Turbopack
  plugin API yet, so we run `next-file-route watch` in parallel. Both are
  combined in the `dev:turbopack` script via `&`.

## Role checks

`meta.roles` is plain data — the library doesn't enforce it. Read it with
`getRouteMeta(getRoutePath(pathname))` and check it against your auth provider
(NextAuth.js, Clerk, custom session, etc.). See "Role checks by path" in the
[main README](../../README.md#role-checks-by-path).
