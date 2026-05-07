import { describe, it, expect } from 'vitest'
import {
  emitManifestModule,
  emitRouteTypes,
} from '../plugin/emit'
import type { Manifest } from '../types'

describe('emitManifestModule', () => {
  it('generates valid module source', () => {
    const manifest: Manifest = {
      routes: {
        '/': { meta: { title: 'Home' } },
        '/admin/users': { meta: { title: 'Users', roles: ['admin'] } },
      },
      layouts: {
        '/': { meta: { title: 'Root' } },
      },
    }

    const source = emitManifestModule(manifest)

    expect(source).toContain('export const __routes')
    expect(source).toContain('"Home"')
    expect(source).toContain('export const __layouts')
    expect(source).toContain('export function __matchRoute')
    expect(source).toContain('export const __searchSchemas = {}')
  })

  it('generates empty module for empty manifest', () => {
    const source = emitManifestModule({ routes: {}, layouts: {} })
    expect(source).toContain('__routesBase = {}')
    expect(source).toContain('export const __layouts = {}')
  })

  it('inlines the schema source for routes with a `route({ search })` Zod schema', () => {
    const manifest: Manifest = {
      routes: {
        '/admin/users': { meta: { title: 'Users' }, search: '__ZOD_SCHEMA__' },
      },
      layouts: {},
    }

    const source = emitManifestModule(manifest, {
      searchRoutes: new Set(['/admin/users']),
      callSearchSources: new Map([
        ['/admin/users', 'z.object({ page: z.number().default(1) })'],
      ]),
    })

    expect(source).toContain("import { z } from 'zod';")
    expect(source).toContain('const __inline_search_0 = z.object({ page: z.number().default(1) });')
    expect(source).toContain('__routesBase["/admin/users"].search = __inline_search_0;')
    expect(source).toContain('"/admin/users": __inline_search_0,')
    expect(source).not.toContain('"__ZOD_SCHEMA__"')
    expect(source).not.toContain('import * as')
    expect(source).not.toContain('routeConfig as __search_')
  })

  it('skips entries in searchRoutes that lack a recorded source string', () => {
    const manifest: Manifest = {
      routes: { '/orphan': { meta: { title: 'Orphan' }, search: '__ZOD_SCHEMA__' } },
      layouts: {},
    }
    const source = emitManifestModule(manifest, {
      searchRoutes: new Set(['/orphan']),
      callSearchSources: new Map(),
    })
    expect(source).not.toContain('__inline_search_')
    expect(source).toContain('export const __searchSchemas = {}')
  })

  it('emits inlines deterministically (sorted by route path)', () => {
    const manifest: Manifest = {
      routes: {
        '/b': { meta: { title: 'B' }, search: '__ZOD_SCHEMA__' },
        '/a': { meta: { title: 'A' }, search: '__ZOD_SCHEMA__' },
      },
      layouts: {},
    }
    const source = emitManifestModule(manifest, {
      searchRoutes: new Set(['/b', '/a']),
      callSearchSources: new Map([
        ['/a', 'z.object({ a: z.string() })'],
        ['/b', 'z.object({ b: z.string() })'],
      ]),
    })
    const aIdx = source.indexOf('__inline_search_0 = z.object({ a:')
    const bIdx = source.indexOf('__inline_search_1 = z.object({ b:')
    expect(aIdx).toBeGreaterThan(0)
    expect(bIdx).toBeGreaterThan(aIdx)
  })
})

describe('emitRouteTypes', () => {
  it('falls back to Record<string, unknown> when no routeValues given', () => {
    const routeToFile = new Map([
      ['/', 'app/page.tsx'],
      ['/admin/users', 'app/admin/users/page.tsx'],
    ])

    const dts = emitRouteTypes(routeToFile)

    expect(dts).toContain("declare module 'next-file-route'")
    expect(dts).toContain('interface RouteMap')
    expect(dts).toContain('"/": Record<string, unknown>')
    expect(dts).toContain('"/admin/users": Record<string, unknown>')
    expect(dts).toContain('export {}')
  })

  it('emits entries sorted by route path so the file is stable across scans', () => {
    const routeToFile = new Map([
      ['/zeta', 'app/zeta/page.tsx'],
      ['/alpha', 'app/alpha/page.tsx'],
      ['/beta', 'app/beta/page.tsx'],
    ])
    const dts = emitRouteTypes(routeToFile)
    const aIdx = dts.indexOf('"/alpha"')
    const bIdx = dts.indexOf('"/beta"')
    const zIdx = dts.indexOf('"/zeta"')
    expect(aIdx).toBeGreaterThan(0)
    expect(bIdx).toBeGreaterThan(aIdx)
    expect(zIdx).toBeGreaterThan(bIdx)
  })

  it('handles an empty route set', () => {
    const dts = emitRouteTypes(new Map())
    expect(dts).toContain('interface RouteMap {')
    expect(dts).toContain('  }')
  })

  it('inlines a meta literal as a readonly object type', () => {
    const routeToFile = new Map([['/admin/users', 'app/admin/users/page.tsx']])
    const routeValues = {
      '/admin/users': { meta: { title: 'Users', breadcrumb: 'Team' } },
    }

    const dts = emitRouteTypes(routeToFile, routeValues)

    expect(dts).toContain('"/admin/users": {')
    expect(dts).toContain('readonly meta: {')
    expect(dts).toContain('readonly title: "Users";')
    expect(dts).toContain('readonly breadcrumb: "Team";')
    expect(dts).not.toContain('Record<string, unknown>')
  })

  it('emits arrays as readonly tuples for literal narrowing', () => {
    const routeToFile = new Map([['/admin', 'app/admin/page.tsx']])
    const routeValues = {
      '/admin': { meta: { roles: ['admin', 'manager'] } },
    }

    const dts = emitRouteTypes(routeToFile, routeValues)

    expect(dts).toContain('readonly roles: readonly ["admin", "manager"];')
  })

  it('replaces a Zod search marker with `unknown`', () => {
    const routeToFile = new Map([['/products', 'app/products/page.tsx']])
    const routeValues = {
      '/products': { meta: { title: 'Products' }, search: '__ZOD_SCHEMA__' },
    }

    const dts = emitRouteTypes(routeToFile, routeValues)

    expect(dts).toContain('readonly search: unknown;')
    expect(dts).toContain('readonly title: "Products";')
    expect(dts).not.toContain('"__ZOD_SCHEMA__"')
  })

  it('quotes object keys that are not valid identifiers', () => {
    const routeToFile = new Map([['/legacy', 'app/legacy/page.tsx']])
    const routeValues = {
      '/legacy': { meta: { 'x-id': 1, 'with space': 'ok' } },
    }

    const dts = emitRouteTypes(routeToFile, routeValues)

    expect(dts).toContain('readonly "x-id": 1;')
    expect(dts).toContain('readonly "with space": "ok";')
  })

  it('falls back to generic when a route has no entry in routeValues', () => {
    const routeToFile = new Map([
      ['/known', 'app/known/page.tsx'],
      ['/unknown', 'app/unknown/page.tsx'],
    ])
    const routeValues = {
      '/known': { meta: { title: 'K' } },
    }

    const dts = emitRouteTypes(routeToFile, routeValues)

    expect(dts).toContain('"/known": {')
    expect(dts).toContain('"/unknown": Record<string, unknown>')
  })

  it('skips object keys whose value is undefined', () => {
    const routeToFile = new Map([['/x', 'app/x/page.tsx']])
    const routeValues = {
      '/x': { meta: { title: 'X', subtitle: undefined } },
    }

    const dts = emitRouteTypes(routeToFile, routeValues)

    expect(dts).toContain('readonly title: "X";')
    expect(dts).not.toContain('subtitle')
  })

  it('falls back to `number` for non-finite numeric literals', () => {
    const routeToFile = new Map([['/n', 'app/n/page.tsx']])
    const routeValues = {
      '/n': { meta: { count: NaN, infinite: Infinity } },
    }

    const dts = emitRouteTypes(routeToFile, routeValues)

    expect(dts).toContain('readonly count: number;')
    expect(dts).toContain('readonly infinite: number;')
    expect(dts).not.toContain('NaN')
    expect(dts).not.toContain('Infinity')
  })

  it('emits empty arrays as readonly unknown[] (not a fixed-length tuple)', () => {
    const routeToFile = new Map([['/e', 'app/e/page.tsx']])
    const routeValues = { '/e': { meta: { roles: [] } } }

    const dts = emitRouteTypes(routeToFile, routeValues)

    expect(dts).toContain('readonly roles: readonly unknown[];')
  })

  it('emits empty objects as Record<string, unknown>', () => {
    const routeToFile = new Map([['/e', 'app/e/page.tsx']])
    const routeValues = { '/e': { meta: {} } }

    const dts = emitRouteTypes(routeToFile, routeValues)

    expect(dts).toContain('readonly meta: Record<string, unknown>;')
  })
})
