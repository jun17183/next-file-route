# next-file-route

File-based routing for Next.js App Router. Declare route data with `route()` inside `page.tsx` / `layout.tsx` — it gets statically extracted at build time and is readable from anywhere.

> 한국어: [README.md](./README.md)

```bash
npm install next-file-route zod
```

```ts
// next.config.ts
import { withFileRoute } from 'next-file-route/plugin'
export default withFileRoute({})
```

```tsx
// app/admin/users/page.tsx
import { route } from 'next-file-route/server'
import { z } from 'zod'

const r = route({
  meta: { title: 'Users', roles: ['admin'] },
  search: z.object({ page: z.number().default(1) }),
})

export const generateMetadata = r.generateMetadata
export default function Page() { return <h1>Users</h1> }
```

Then read it from anywhere.

```ts
import { getRouteConfig, getRoutePath } from 'next-file-route/server'
import { useRoute, useSearch } from 'next-file-route'

getRouteConfig('/admin/users').meta  // { title: 'Users', roles: ['admin'] }
getRoutePath('/admin/users/123')     // '/admin/users/[id]'
useRoute()                           // entry for the current pathname
useSearch().page                     // Zod-parsed search
```

Bundlers: webpack / Turbopack / Vite / Rspack. Vite uses `fileRouteVite()`, the rest go through one `withFileRoute()`.
CLI: `init` / `sync` / `watch` / `inspect`.

## Caveats

- `route()` cannot be called from a `'use client'` file — server-only. Put it on the parent layout.
- The Zod in `route({ search })` is sliced verbatim at build time. Inline literals only; no references to outside consts.
- Only `import { z } from 'zod'` is assumed. Aliased imports break extraction.

MIT.
