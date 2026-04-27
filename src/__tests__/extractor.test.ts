import { describe, it, expect } from 'vitest'
import { extractRouteCall, ZOD_SCHEMA_MARKER } from '../plugin/extract'
import { parseSource } from '../plugin/parse'

function parseAndExtract(source: string, file = 'app/page.tsx') {
  const parsed = parseSource(source, file)
  if ('error' in parsed) throw new Error(parsed.error)
  return extractRouteCall(parsed.ast, source, file)
}

function extract(routeConfigBody: string, file = 'app/page.tsx') {
  const source = `
    import { route } from 'next-file-route/server'
    route(${routeConfigBody})
  `
  return parseAndExtract(source, file)
}

function extractWithPreamble(preamble: string, routeConfigBody: string, file = 'app/page.tsx') {
  const source = `
    import { route } from 'next-file-route/server'
    ${preamble}
    route(${routeConfigBody})
  `
  return parseAndExtract(source, file)
}

describe('extractRouteCall', () => {
  it('extracts simple meta object', () => {
    const result = extract(`{ meta: { title: 'Home' } }`)
    expect(result.value).toEqual({ meta: { title: 'Home' } })
    expect(result.warnings).toHaveLength(0)
  })

  it('returns null when no route() call is present', () => {
    const result = parseAndExtract(
      `export default function Page() { return null }`,
      'app/page.tsx',
    )
    expect(result.value).toBeNull()
  })

  it('extracts nested objects', () => {
    const result = extract(`{
      meta: { title: 'Admin', roles: ['admin', 'superadmin'] },
      analytics: { event: 'view_admin', category: 'admin' },
    }`)
    expect(result.value).toEqual({
      meta: { title: 'Admin', roles: ['admin', 'superadmin'] },
      analytics: { event: 'view_admin', category: 'admin' },
    })
  })

  it('extracts numeric and boolean values', () => {
    const result = extract(`{
      meta: { title: 'Test', hidden: true, order: 3, score: -1.5 },
    }`)
    expect(result.value).toEqual({
      meta: { title: 'Test', hidden: true, order: 3, score: -1.5 },
    })
  })

  it('extracts null values', () => {
    const result = extract(`{
      meta: { title: 'Test', parent: null },
    }`)
    expect(result.value).toEqual({
      meta: { title: 'Test', parent: null },
    })
  })

  it('resolves same-file const references', () => {
    const result = extractWithPreamble(
      `const ADMIN_ROLES = ['admin', 'manager']`,
      `{ meta: { title: 'Users', roles: ADMIN_ROLES } }`,
    )
    expect(result.value).toEqual({
      meta: { title: 'Users', roles: ['admin', 'manager'] },
    })
  })

  it('resolves same-file exported const', () => {
    const result = extractWithPreamble(
      `export const PAGE_TITLE = 'Dashboard'`,
      `{ meta: { title: PAGE_TITLE } }`,
    )
    expect(result.value).toEqual({ meta: { title: 'Dashboard' } })
  })

  it('handles as const assertions', () => {
    const result = extractWithPreamble(
      `const ROLES = ['admin'] as const`,
      `{ meta: { roles: ROLES } }`,
    )
    expect(result.value).toEqual({ meta: { roles: ['admin'] } })
  })

  it('handles satisfies type assertions', () => {
    const result = extract(`{
      meta: {
        title: 'Admin',
        roles: ['admin'],
      } satisfies AppRouteMeta,
    }`)
    expect(result.value).toEqual({
      meta: { title: 'Admin', roles: ['admin'] },
    })
  })

  it('handles template literals without expressions', () => {
    const result = extract(`{ meta: { title: \`Hello World\` } }`)
    expect(result.value).toEqual({ meta: { title: 'Hello World' } })
  })

  it('extracts arbitrary user-defined keys', () => {
    const result = extract(`{
      meta: { title: 'Product' },
      parentTab: '/products',
      modals: ['/products/delete'],
      analytics: { event: 'view_product' },
    }`)
    expect(result.value).toEqual({
      meta: { title: 'Product' },
      parentTab: '/products',
      modals: ['/products/delete'],
      analytics: { event: 'view_product' },
    })
  })

  it('warns on function calls', () => {
    const result = extract(`{ meta: { title: 'Test', roles: getRoles() } }`)
    expect(result.value).toEqual({ meta: { title: 'Test' } })
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0].field).toBe('meta.roles')
  })

  it('warns on unresolvable identifiers', () => {
    const result = extractWithPreamble(
      `import { EXTERNAL } from './constants'`,
      `{ meta: { title: 'Test', data: EXTERNAL } }`,
    )
    expect(result.value).toEqual({ meta: { title: 'Test' } })
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('handles spread from same-file const', () => {
    const result = extractWithPreamble(
      `const BASE = { hidden: false, order: 1 }`,
      `{ meta: { title: 'Test', ...BASE } }`,
    )
    expect(result.value).toEqual({
      meta: { title: 'Test', hidden: false, order: 1 },
    })
  })

  it('handles .js files', () => {
    const result = parseAndExtract(
      `import { route } from 'next-file-route/server'\nroute({ meta: { title: 'JS' } })`,
      'app/page.js',
    )
    expect(result.value).toEqual({ meta: { title: 'JS' } })
  })

  it('handles .jsx files', () => {
    const result = parseAndExtract(
      `import { route } from 'next-file-route/server'\nroute({ meta: { title: 'JSX' } })`,
      'app/page.jsx',
    )
    expect(result.value).toEqual({ meta: { title: 'JSX' } })
  })

  it('handles empty routeConfig', () => {
    const result = extract(`{}`)
    expect(result.value).toEqual({})
  })

  describe('Zod schema detection', () => {
    it('detects z.object() as search schema', () => {
      const result = extractWithPreamble(
        `import { z } from 'zod'`,
        `{
          meta: { title: 'Products' },
          search: z.object({
            page: z.number().default(1),
            sort: z.enum(['asc', 'desc']).default('asc'),
          }),
        }`,
      )
      expect(result.value).toEqual({
        meta: { title: 'Products' },
        search: ZOD_SCHEMA_MARKER,
      })
      expect(result.hasSearch).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('detects chained Zod methods', () => {
      const result = extractWithPreamble(
        `import { z } from 'zod'`,
        `{ search: z.object({ q: z.string().optional() }) }`,
      )
      expect(result.value?.search).toBe(ZOD_SCHEMA_MARKER)
      expect(result.hasSearch).toBe(true)
    })

    it('still warns on non-Zod function calls', () => {
      const result = extract(`{ meta: { title: 'Test', roles: getRoles() } }`)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.hasSearch).toBe(false)
    })

    it('routeConfig with meta only (no search)', () => {
      const result = extract(`{ meta: { title: 'Home' } }`)
      expect(result.hasSearch).toBe(false)
      expect(result.value).toEqual({ meta: { title: 'Home' } })
    })

    it('detects Zod even when imported under an alias (named)', () => {
      const result = extractWithPreamble(
        `import { z as zod } from 'zod'`,
        `{ search: zod.object({ q: zod.string() }) }`,
      )
      expect(result.value?.search).toBe(ZOD_SCHEMA_MARKER)
      expect(result.hasSearch).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('detects Zod when imported as default', () => {
      const result = extractWithPreamble(
        `import zod from 'zod'`,
        `{ search: zod.object({ q: zod.string() }) }`,
      )
      expect(result.value?.search).toBe(ZOD_SCHEMA_MARKER)
      expect(result.hasSearch).toBe(true)
    })

    it('detects Zod when imported via namespace import', () => {
      const result = extractWithPreamble(
        `import * as Z from 'zod'`,
        `{ search: Z.object({ q: Z.string() }) }`,
      )
      expect(result.value?.search).toBe(ZOD_SCHEMA_MARKER)
      expect(result.hasSearch).toBe(true)
    })
  })

  describe('warning location', () => {
    it('reports a 1-based line and column for the offending node', () => {
      const source =
        "import { route } from 'next-file-route/server'\n" +
        'route({\n' +
        '  meta: { title: getTitle() },\n' +
        '})\n'
      const result = parseAndExtract(source, 'app/page.tsx')
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].line).toBe(3)
      expect(result.warnings[0].column).toBeGreaterThan(0)
    })
  })

  describe('route() builder pattern', () => {
    it('extracts from a bare top-level route() call', () => {
      const result = parseAndExtract(
        `import { route } from 'next-file-route/server'\nroute({ meta: { title: 'Bare' } })`,
      )
      expect(result.value).toEqual({ meta: { title: 'Bare' } })
    })

    it("extracts from `const r = route({...})`", () => {
      const result = parseAndExtract(
        `import { route } from 'next-file-route/server'\nconst r = route({ meta: { title: 'Const' } })`,
      )
      expect(result.value).toEqual({ meta: { title: 'Const' } })
    })

    it('extracts from a chained member access', () => {
      const result = parseAndExtract(
        `import { route } from 'next-file-route/server'\nexport const generateMetadata = route({ meta: { title: 'Chained' } }).generateMetadata`,
      )
      expect(result.value).toEqual({ meta: { title: 'Chained' } })
    })

    it('respects an aliased import (route as r)', () => {
      const result = parseAndExtract(
        `import { route as r } from 'next-file-route/server'\nr({ meta: { title: 'Aliased' } })`,
      )
      expect(result.value).toEqual({ meta: { title: 'Aliased' } })
    })

    it('only matches when the import comes from next-file-route(/server)', () => {
      const result = parseAndExtract(
        `import { route } from 'some-other-package'\nconst r = route({ meta: { title: 'NoMatch' } })`,
      )
      expect(result.value).toBeNull()
    })

    it('ignores legacy `export const routeConfig` (page.meta.ts pattern is gone)', () => {
      const result = parseAndExtract(
        `export const routeConfig = { meta: { title: 'Legacy' } }`,
      )
      expect(result.value).toBeNull()
    })

    it('flags Zod search inside route() with hasSearch=true', () => {
      const result = parseAndExtract(
        `import { route } from 'next-file-route/server'\nimport { z } from 'zod'\nroute({\n  meta: { title: 'WithSearch' },\n  search: z.object({ q: z.string() }),\n})`,
      )
      expect(result.value?.search).toBe(ZOD_SCHEMA_MARKER)
      expect(result.hasSearch).toBe(true)
      expect(result.searchSource).toMatch(/^z\.object/)
    })
  })
})
