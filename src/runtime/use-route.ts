'use client'

import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { getRoutePath, getManifestRoutes } from './manifest'
import type { RoutePath, AnyRouteConfig } from '../types'

export interface CurrentRoute {
  path: RoutePath
  config: AnyRouteConfig
  meta: Record<string, unknown> | undefined
}

export function useRoute(): CurrentRoute | null {
  const pathname = usePathname()
  const routes = getManifestRoutes()

  return useMemo(() => {
    const path = getRoutePath(pathname)
    if (!path) return null
    const config = routes[path as string] as AnyRouteConfig
    const meta =
      config && typeof config === 'object'
        ? ((config as { meta?: unknown }).meta as Record<string, unknown> | undefined)
        : undefined
    return { path, config, meta }
  }, [pathname, routes])
}
