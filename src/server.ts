export {
  getRouteConfig,
  getRouteMeta,
  getRoutes,
  getRoutePath,
  parseSearch,
} from './runtime/get'
export { route } from './runtime/route'

export type {
  RoutePath,
  RouteMap,
  AnyRouteConfig,
  RouteEntry,
  RouteConfigOf,
  RouteMetaOf,
} from './types'
export type {
  RouteHandle,
  GenerateMetadataArgs,
  MetadataObject,
} from './runtime/route'
