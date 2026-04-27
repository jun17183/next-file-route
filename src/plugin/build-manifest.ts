import type { Manifest } from '../types'
import type { ExtractionResult } from './extract'

export interface Extraction {
  relPath: string
  routePath: string
  kind: 'page' | 'layout'
  result: ExtractionResult
}

export interface ManifestData {
  manifest: Manifest
  routeToFile: Map<string, string>
  layoutToFile: Map<string, string>
  searchRoutes: Set<string>
  callSearchSources: Map<string, string>
}

export function buildManifest(extractions: Extraction[]): ManifestData {
  const manifest: Manifest = { routes: {}, layouts: {} }
  const routeToFile = new Map<string, string>()
  const layoutToFile = new Map<string, string>()
  const searchRoutes = new Set<string>()
  const callSearchSources = new Map<string, string>()

  for (const e of extractions) {
    if (!e.result.value) continue

    if (e.kind === 'page') {
      manifest.routes[e.routePath] = e.result.value
      routeToFile.set(e.routePath, e.relPath)
      if (e.result.hasSearch && e.result.searchSource) {
        searchRoutes.add(e.routePath)
        callSearchSources.set(e.routePath, e.result.searchSource)
      }
    } else {
      manifest.layouts[e.routePath] = e.result.value
      layoutToFile.set(e.routePath, e.relPath)
    }
  }

  return {
    manifest,
    routeToFile,
    layoutToFile,
    searchRoutes,
    callSearchSources,
  }
}
