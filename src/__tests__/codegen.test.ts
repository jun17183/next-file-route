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
  it('emits one RouteMap entry per page with a generic value type', () => {
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
})
