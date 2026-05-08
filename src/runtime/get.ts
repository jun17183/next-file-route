import { getManifestRoutes, getSearchSchema } from './manifest'
import { coerceSearchParams } from '../utils/zod-coerce'
import type {
  RoutePath,
  RouteEntry,
  RouteConfigOf,
  RouteMetaOf,
  SearchOf,
} from '../types'

export { getRoutePath } from './manifest'

export function getRouteConfig<P extends RoutePath>(
  path: P,
): RouteConfigOf<P> | undefined {
  const routes = getManifestRoutes()
  return routes[path as string] as RouteConfigOf<P> | undefined
}

export function getRouteMeta<P extends RoutePath>(
  path: P,
): RouteMetaOf<P> | undefined {
  const config = getRouteConfig(path)
  if (!config || typeof config !== 'object') return undefined
  return (config as { meta?: unknown }).meta as RouteMetaOf<P> | undefined
}

export function getRoutes(): RouteEntry[] {
  const routes = getManifestRoutes()
  return Object.entries(routes).map(([path, config]) => ({
    path: path as RouteEntry['path'],
    config: config as RouteEntry['config'],
  }))
}

export async function parseSearch<P extends RoutePath>(
  path: P,
  searchParams: Record<string, string | string[]> | Promise<Record<string, string | string[]>>,
): Promise<SearchOf<P>> {
  const schema = getSearchSchema(path as string)
  if (!schema || typeof schema !== 'object' || !('parse' in (schema as any))) {
    return {} as SearchOf<P>
  }

  const params = searchParams instanceof Promise ? await searchParams : searchParams
  const coerced = coerceSearchParams(params, schema)

  try {
    return (schema as any).parse(coerced) as SearchOf<P>
  } catch (parseErr) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[next-file-route] parseSearch: schema validation failed for "${String(path)}", ` +
          'falling back to schema defaults.',
        parseErr,
      )
    }
    try {
      return (schema as any).parse({}) as SearchOf<P>
    } catch {
      return {} as SearchOf<P>
    }
  }
}

