import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { scanRoutes } from '../plugin/scan'
import { emitManifestModule, emitRouteTypes } from '../plugin/emit'
import { ZOD_SCHEMA_MARKER } from '../plugin/extract'

const FIXTURES_V2 = resolve(__dirname, 'fixtures-v2')

describe('scanner + codegen integration with route() fixtures', () => {
  it('scans fixtures and detects which routes have a Zod search schema', () => {
    const result = scanRoutes({ root: FIXTURES_V2 })

    expect(result.manifest.routes['/']).toEqual({ meta: { title: 'Home' } })

    const products = result.manifest.routes['/products'] as Record<string, unknown>
    expect(products.meta).toEqual({ title: 'Products' })
    expect(products.search).toBe(ZOD_SCHEMA_MARKER)

    expect(result.searchRoutes.has('/products')).toBe(true)
    expect(result.searchRoutes.has('/')).toBe(false)

    expect(result.callSearchSources.get('/products')).toMatch(/^z\.object/)
  })

  it('generates a manifest that inlines the search schema and pulls zod', () => {
    const result = scanRoutes({ root: FIXTURES_V2 })

    const source = emitManifestModule(result.manifest, {
      searchRoutes: result.searchRoutes,
      callSearchSources: result.callSearchSources,
    })

    expect(source).not.toContain('routeConfig as __search_')
    expect(source).not.toContain('import * as')

    expect(source).toContain("import { z } from 'zod';")
    expect(source).toContain('__inline_search_0 = z.object(')
    expect(source).toContain('"/products": __inline_search_0,')

    expect(source).not.toContain(ZOD_SCHEMA_MARKER)
    expect(source).toContain('"Home"')
  })

  it('generates .d.ts with one RouteMap entry per route', () => {
    const result = scanRoutes({ root: FIXTURES_V2 })

    const dts = emitRouteTypes(result.routeToFile)

    expect(dts).toContain('"/": Record<string, unknown>')
    expect(dts).toContain('"/products": Record<string, unknown>')
  })

  it('routes without a search schema have no entry in searchRoutes', () => {
    const result = scanRoutes({ root: FIXTURES_V2 })

    const home = result.manifest.routes['/'] as Record<string, unknown>
    expect(home.meta).toEqual({ title: 'Home' })
    expect(home.search).toBeUndefined()
    expect(result.searchRoutes.has('/')).toBe(false)
    expect(result.callSearchSources.has('/')).toBe(false)
  })
})
