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

// SearchOf<P>: structural duck-typing of a Zod schema's inferred type
// without importing zod. The schema type itself comes from the user's
// page file via `typeof import(...)["r"]["search"]` in routes.d.ts.
//   `_output`        — Zod 3 + Zod 4 classic compat layer
//   `_zod.output`    — Zod 4 native
export type SearchOf<P> = keyof RouteMap extends never
  ? Record<string, unknown>
  : P extends keyof RouteMap
    ? RouteMap[P] extends { search: infer S }
      ? InferZodOutput<S>
      : Record<string, unknown>
    : Record<string, unknown>

type InferZodOutput<S> = S extends { _output: infer O }
  ? O
  : S extends { _zod: { output: infer O } }
    ? O
    : Record<string, unknown>

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
