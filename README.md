# next-file-route

Next.js App Router용 파일 기반 라우팅. `page.tsx` / `layout.tsx`에 `route()`로 라우트 데이터를 적으면 빌드 시 정적 추출해서 어디서든 읽을 수 있다.

> English: [README.en.md](./README.en.md)

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
  meta: { title: '사용자', roles: ['admin'] },
  search: z.object({ page: z.number().default(1) }),
})

export const generateMetadata = r.generateMetadata
export default function Page() { return <h1>Users</h1> }
```

이제 어디서든 그 데이터를 읽는다.

```ts
import { getRouteConfig, getRoutePath } from 'next-file-route/server'
import { useRoute, useSearch } from 'next-file-route'

getRouteConfig('/admin/users').meta  // { title: '사용자', roles: ['admin'] }
getRoutePath('/admin/users/123')     // '/admin/users/[id]'
useRoute()                           // 현재 pathname의 entry
useSearch().page                     // Zod로 검증된 search
```

번들러는 webpack / Turbopack / Vite / Rspack. Vite는 `fileRouteVite()`, 나머지는 `withFileRoute()` 하나.
CLI: `init` / `sync` / `watch` / `inspect`.

## 제약

- `'use client'` 파일에서 `route()` 호출 불가. 서버 전용이라 부모 layout에 둔다.
- `route({ search })`의 Zod는 빌드 시 verbatim 슬라이스. 인라인 literal만, 외부 const 참조 X.
- `import { z } from 'zod'`만 가정. alias 깨짐.

MIT.
