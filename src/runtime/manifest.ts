import * as manifest from 'next-file-route/.generated/manifest'
import type { RoutePath } from '../types'

const routes: Record<string, unknown> = manifest.__routes ?? {}
const layouts: Record<string, unknown> = manifest.__layouts ?? {}
const searchSchemas: Record<string, unknown> = manifest.__searchSchemas ?? {}
const matchRouteFn: ((pathname: string) => string | null) | null =
  typeof manifest.__matchRoute === 'function' ? manifest.__matchRoute : null

export function getManifestRoutes(): Record<string, unknown> {
  return routes
}

export function getManifestLayouts(): Record<string, unknown> {
  return layouts
}

export function getSearchSchemas(): Record<string, unknown> {
  return searchSchemas
}

export function getSearchSchema(routePath: string): unknown | null {
  return searchSchemas[routePath] ?? null
}

export function getRoutePath(pathname: string): RoutePath | null {
  if (matchRouteFn) return matchRouteFn(pathname) as RoutePath | null
  return Object.prototype.hasOwnProperty.call(routes, pathname)
    ? (pathname as RoutePath)
    : null
}
