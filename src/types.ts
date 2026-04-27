// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RouteMap {}

export type RoutePath = keyof RouteMap extends never ? string : keyof RouteMap

export type AnyRouteConfig = keyof RouteMap extends never
  ? Record<string, unknown>
  : RouteMap[keyof RouteMap]

export type RouteConfigOf<P> = keyof RouteMap extends never
  ? AnyRouteConfig
  : P extends keyof RouteMap
    ? RouteMap[P]
    : AnyRouteConfig

export type RouteMetaOf<P> = RouteConfigOf<P> extends { meta: infer M }
  ? M
  : RouteConfigOf<P> extends { meta?: infer M }
    ? M | undefined
    : undefined

export interface PluginOptions {
  requireConfig?: boolean
  include?: string[]
}

export interface Manifest {
  routes: Record<string, unknown>
  layouts: Record<string, unknown>
}

export interface RouteEntry {
  path: RoutePath
  config: AnyRouteConfig | undefined
}
