# next-file-route

[![npm](https://img.shields.io/npm/v/next-file-route.svg)](https://www.npmjs.com/package/next-file-route) [![license](https://img.shields.io/npm/l/next-file-route.svg)](./LICENSE)

Next.js App Router용 파일 기반 라우팅. `page.tsx` / `layout.tsx`에 `route()`로 라우트 데이터를 적으면 빌드 시 정적 추출해서 어디서든 읽을 수 있다.

> English: [README.md](./README.md)

## 왜 쓰나

페이지 제목, 접근 권한, 메뉴 라벨, search param 스키마 같은 라우트 단위 데이터는 보통 별도 `routes.ts`에 모이고, 실제 `app/` 트리와 금방 어긋난다. next-file-route는 각 페이지가 자기 데이터를 컴포넌트 옆에 선언하고, 생성된 타입 안전 매니페스트로 경로만 주면 어디서든(서버 컴포넌트, 클라이언트 컴포넌트, 권한 헬퍼, 메뉴 빌더) 조회할 수 있게 한다.

## 설치

```bash
npm install next-file-route zod
```

Next.js 설정을 감싼다.

```ts
// next.config.ts
import { withFileRoute } from 'next-file-route/plugin'

export default withFileRoute({
  // 기존 Next.js 설정
})
```

CLI로 설정 패치와 첫 스캔을 한 번에 할 수도 있다.

```bash
npx next-file-route init
```

## 빠른 시작

### 1. 라우트 데이터 선언

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

// meta는 Next.js metadata(title, description 등)로도 쓰인다
export const generateMetadata = r.generateMetadata

export default function Page() {
  return <h1>Users</h1>
}
```

- `meta` — 아무 평범한 객체. 넣은 그대로 돌려준다.
- `search` — 페이지 search params용 Zod 스키마(선택).

### 2. 어디서든 읽기

서버에서:

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

클라이언트에서:

```tsx
'use client'
import { useRoute, useSearch } from 'next-file-route'

export function PageHeader() {
  const route = useRoute()  // 현재 pathname의 { path, config, meta } 또는 null
  return <h1>{route?.meta?.title as string}</h1>
}

export function UserList() {
  const { page, q } = useSearch('/admin/users')  // 타입: { page: number; q?: string }
  // ...
}
```

라우트 경로는 타입 체크된다. `getRouteConfig('/admin/userz')`는 타입 에러.

## 예시

### 서버 페이지에서 타입 있는 search params

`parseSearch`는 `searchParams`를 페이지의 Zod 스키마로 검증한다. URL의 문자열은 스키마 타입으로 변환되고(`'2'` → `2`), 잘못된 입력은 throw 대신 스키마 기본값으로 폴백한다.

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

### 네비게이션 메뉴 만들기

```tsx
import { getRoutes, getRouteMeta } from 'next-file-route/server'

export function Nav() {
  const links = getRoutes()
    .filter((r) => !r.path.includes('['))  // 동적 세그먼트 제외
    .map((r) => ({ href: r.path, label: getRouteMeta(r.path)?.title ?? r.path }))

  return (
    <nav>
      {links.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
    </nav>
  )
}
```

### 경로 기준 권한 체크

```ts
import { getRouteMeta, getRoutePath } from 'next-file-route/server'

export function canAccess(pathname: string, userRoles: string[]) {
  const path = getRoutePath(pathname)  // '/admin/users/123' → '/admin/users/[id]'
  if (!path) return true
  const roles = getRouteMeta(path)?.roles as string[] | undefined
  return !roles || roles.some((role) => userRoles.includes(role))
}
```

### 레이아웃

`route()`는 `layout.tsx`에서도 쓸 수 있다. 예를 들어 섹션 전체의 기본 title을 줄 때:

```tsx
// app/admin/layout.tsx
import { route } from 'next-file-route/server'

export const r = route({
  meta: { title: 'Admin', section: 'admin' },
})

export const generateMetadata = r.generateMetadata
```

레이아웃 데이터는 페이지 데이터와 따로 저장된다. `getRouteConfig()`는 페이지가 직접 선언한 것만 돌려준다.

### 라우트 경로

파일 경로는 Next.js와 같은 규칙으로 라우트 경로가 된다.

| 파일 | 라우트 경로 |
|---|---|
| `app/page.tsx` | `/` |
| `app/admin/users/page.tsx` | `/admin/users` |
| `app/(marketing)/about/page.tsx` | `/about` (route group 제거) |
| `app/posts/[id]/page.tsx` | `/posts/[id]` |
| `app/docs/[...slug]/page.tsx` | `/docs/[...slug]` |

`getRoutePath()`와 `useRoute()`는 실제 pathname을 이 패턴에 매칭하며, 동적 세그먼트보다 정적 세그먼트를 우선한다.

## 번들러

| 번들러 | 설정 |
|---|---|
| webpack (`next dev` / `next build`) | `withFileRoute()` — 파일 변경 시 자동 재생성 |
| Turbopack (`next dev --turbopack`) | `withFileRoute()` + 실시간 반영은 `next-file-route watch` 병행 |
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

### 옵션

`withFileRoute(config, options)`와 `fileRouteVite(options)` 공통:

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `include` | `['app/**/{page,layout}.{ts,tsx,js,jsx}']` | 스캔할 glob 패턴 |
| `requireConfig` | `false` | `route()` 호출이 없는 페이지에 경고 |
| `root` (Vite 전용) | `process.cwd()` | 스캔 기준 프로젝트 루트 |

## CLI

```bash
npx next-file-route init     # next.config 패치 + 첫 sync
npx next-file-route sync     # 한 번 스캔해서 매니페스트·타입 재생성
npx next-file-route watch    # 변경마다 재스캔 (Turbopack 등)
npx next-file-route inspect  # 현재 매니페스트를 JSON으로 출력
```

모든 명령은 `--root <dir>`를 받는다. 생성 파일은 `node_modules/next-file-route/.generated/`에 있다.

## 제약

- `route()` 결과를 `export const r =` 으로 export하면 `useSearch()` 리턴이 Zod 추론 결과로 좁혀진다. export 안 하면 `unknown` 폴백. (`const r = route(...); export { r }` 같이 분리된 export 패턴은 미지원.)
- 한 파일에 `route()` 호출은 하나만. 두 번째 호출은 조용히 무시된다.
- `'use client'` 파일에서 `route()` 호출 불가. 서버 전용이라 부모 layout에 둔다.
- `route({ search })`의 Zod는 빌드 시 verbatim 슬라이스. 인라인 literal만, 외부 const 참조 X.
- `import { z } from 'zod'`만 가정. alias 깨짐.

## 라이선스

MIT
