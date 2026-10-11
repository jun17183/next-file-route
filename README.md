# next-file-route

[![npm](https://img.shields.io/npm/v/next-file-route.svg)](https://www.npmjs.com/package/next-file-route) [![license](https://img.shields.io/npm/l/next-file-route.svg)](./LICENSE)

File-based routing for Next.js App Router. Declare route data with `route()` inside `page.tsx` / `layout.tsx` — it gets statically extracted at build time and is readable from anywhere.

> 한국어: [README.ko.md](./README.ko.md)

## Why

Route-level data like page titles, required roles, nav labels, or search param schemas usually ends up in a separate `routes.ts` that drifts from the actual `app/` tree. With next-file-route, each page declares its own data next to its component, and a generated, typed manifest lets you look it up by path — from server components, client components, middleware-like helpers, or nav builders.

## Install

```bash
npm install next-file-route zod
```

Wrap your Next.js config:

```ts
// next.config.ts
import { withFileRoute } from 'next-file-route/plugin'

export default withFileRoute({
  // your existing Next.js config
})
```

Or let the CLI patch it and run the first scan:

```bash
npx next-file-route init
```

## Quick start

### 1. Declare route data

```tsx
// app/admin/users/page.tsx
import { route } from 'next-file-route/server'
import { z } from 'zod'

export const r = route({
  meta: { title: 'Users', roles: ['admin'] },
  search: z.object({
    page: z.number().default(1),
    q: z.string().optional(),
  }),
})

// `meta` doubles as Next.js metadata (title, description, ...)
export const generateMetadata = r.generateMetadata

export default function Page() {
  return <h1>Users</h1>
}
```

- `meta` — any plain object. Whatever you put here is returned as-is.
- `search` — an optional Zod schema for the page's search params.

### 2. Read it from anywhere

On the server:

```ts
import {
  getRouteConfig,
  getRouteMeta,
  getRoutePath,
  getRoutes,
} from 'next-file-route/server'

getRouteConfig('/admin/users')    // { meta: {...}, search: ... }
getRouteMeta('/admin/users')      // { title: 'Users', roles: ['admin'] }
getRoutePath('/admin/users/123')  // '/admin/users/[id]'
getRoutes()                       // [{ path: '/', config }, { path: '/admin/users', config }, ...]
```

On the client:

```tsx
'use client'
import { useRoute, useSearch } from 'next-file-route'

export function PageHeader() {
  const route = useRoute()  // { path, config, meta } for the current pathname, or null
  return <h1>{route?.meta?.title as string}</h1>
}

export function UserList() {
  const { page, q } = useSearch('/admin/users')  // typed: { page: number; q?: string }
  // ...
}
```

Route paths are type-checked: `getRouteConfig('/admin/userz')` is a type error.

## Examples

### Typed search params in a server page

`parseSearch` validates `searchParams` against the page's Zod schema. Strings from the URL are coerced to the schema's types (`'2'` → `2`), and invalid input falls back to schema defaults instead of throwing.

```tsx
// app/products/page.tsx
import { route, parseSearch } from 'next-file-route/server'
import { z } from 'zod'

export const r = route({
  meta: { title: 'Products' },
  search: z.object({
    page: z.number().default(1),
    sort: z.enum(['asc', 'desc']).default('asc'),
  }),
})

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>
}) {
  const { page, sort } = await parseSearch('/products', searchParams)
  // /products?page=2      → { page: 2, sort: 'asc' }
  // /products?page=oops   → { page: 1, sort: 'asc' }
  return <ProductTable page={page} sort={sort} />
}
```

### Building a navigation menu

```tsx
import { getRoutes, getRouteMeta } from 'next-file-route/server'

export function Nav() {
  const links = getRoutes()
    .filter((r) => !r.path.includes('['))  // skip dynamic segments
    .map((r) => ({ href: r.path, label: getRouteMeta(r.path)?.title ?? r.path }))

  return (
    <nav>
      {links.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
    </nav>
  )
}
```

### Role checks by path

```ts
import { getRouteMeta, getRoutePath } from 'next-file-route/server'

export function canAccess(pathname: string, userRoles: string[]) {
  const path = getRoutePath(pathname)  // '/admin/users/123' → '/admin/users/[id]'
  if (!path) return true
  const roles = getRouteMeta(path)?.roles as string[] | undefined
  return !roles || roles.some((role) => userRoles.includes(role))
}
```

### Layouts

`route()` also works in `layout.tsx`, e.g. to give a whole section a default title:

```tsx
// app/admin/layout.tsx
import { route } from 'next-file-route/server'

export const r = route({
  meta: { title: 'Admin', section: 'admin' },
})

export const generateMetadata = r.generateMetadata
```

Layout data is stored separately from page data — `getRouteConfig()` returns only what the page itself declared.

### Route paths

File paths map to route paths the same way Next.js does:

| File | Route path |
|---|---|
| `app/page.tsx` | `/` |
| `app/admin/users/page.tsx` | `/admin/users` |
| `app/(marketing)/about/page.tsx` | `/about` (route groups are dropped) |
| `app/posts/[id]/page.tsx` | `/posts/[id]` |
| `app/docs/[...slug]/page.tsx` | `/docs/[...slug]` |

`getRoutePath()` and `useRoute()` match a concrete pathname against these patterns, preferring static segments over dynamic ones.

## Bundlers

| Bundler | Setup |
|---|---|
| webpack (`next dev` / `next build`) | `withFileRoute()` — regenerates on file changes |
| Turbopack (`next dev --turbopack`) | `withFileRoute()` + run `next-file-route watch` alongside for live updates |
| Vite | `fileRouteVite()` |
| Rspack | `withFileRoute()` |

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { fileRouteVite } from 'next-file-route/plugin'

export default defineConfig({
  plugins: [fileRouteVite()],
})
```

### Options

Both `withFileRoute(config, options)` and `fileRouteVite(options)` accept:

| Option | Default | Description |
|---|---|---|
| `include` | `['app/**/{page,layout}.{ts,tsx,js,jsx}']` | Glob patterns to scan |
| `requireConfig` | `false` | Warn when a page has no `route()` call |
| `root` (Vite only) | `process.cwd()` | Project root to scan from |

## CLI

```bash
npx next-file-route init     # patch next.config and run the first sync
npx next-file-route sync     # scan once and regenerate manifest + types
npx next-file-route watch    # rescan on every change (Turbopack, etc.)
npx next-file-route inspect  # print the current manifest as JSON
```

All commands accept `--root <dir>`. Generated files live in `node_modules/next-file-route/.generated/`.

## Caveats

- Exporting the result as `export const r = route(...)` lets `useSearch()` return the Zod-inferred type. If you don't export, search params fall back to `unknown`. (Detached `export { r }` after a `const r = route(...)` is not supported.)
- One `route()` call per file. A second call is silently ignored.
- `route()` cannot be called from a `'use client'` file — server-only. Put it on the parent layout.
- The `search` Zod schema is sliced verbatim at build time. Inline literals only; no references to external consts.
- Assumes `import { z } from 'zod'`. Aliased imports break.

## License

MIT
