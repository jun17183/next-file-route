export type GenerateMetadataArgs = {
  params?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>
}

export type MetadataObject = Record<string, unknown>

export interface RouteHandle<C> {
  config: C
  meta: C extends { meta: infer M }
    ? M
    : C extends { meta?: infer M }
      ? M | undefined
      : undefined
  search: C extends { search: infer S }
    ? S
    : C extends { search?: infer S }
      ? S | undefined
      : undefined
  generateMetadata: ((args?: GenerateMetadataArgs) => Promise<MetadataObject>) & {
    readonly search?: unknown
  }
  metadata: MetadataObject & { __nfr_search?: unknown }
}

export function route<const C>(config: C): RouteHandle<C> {
  const meta = readMeta(config)
  const search = readSearch(config)

  const generateMetadata = (async (_args?: GenerateMetadataArgs) =>
    meta && typeof meta === 'object' ? { ...meta } : {}) as RouteHandle<C>['generateMetadata']

  if (search !== undefined) {
    Object.defineProperty(generateMetadata, 'search', {
      value: search,
      enumerable: true,
      configurable: false,
      writable: false,
    })
  }

  const metadata = (
    meta && typeof meta === 'object' ? { ...meta } : {}
  ) as RouteHandle<C>['metadata']
  if (search !== undefined) metadata.__nfr_search = search

  return {
    config,
    meta: meta as RouteHandle<C>['meta'],
    search: search as RouteHandle<C>['search'],
    generateMetadata,
    metadata,
  }
}

function readMeta(config: unknown): unknown {
  if (!config || typeof config !== 'object') return undefined
  return (config as { meta?: unknown }).meta
}

function readSearch(config: unknown): unknown {
  if (!config || typeof config !== 'object') return undefined
  return (config as { search?: unknown }).search
}
