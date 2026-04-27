export {
  getRouteConfig,
  getRouteMeta,
  getRoutes,
  getRoutePath,
  parseSearch,
} from './runtime/get'
export { useRoute } from './runtime/use-route'
export { useSearch } from './runtime/use-search'

export type { CurrentRoute } from './runtime/use-route'
export type {
  RoutePath,
  RouteMap,
  AnyRouteConfig,
  RouteEntry,
  RouteConfigOf,
  RouteMetaOf,
} from './types'
