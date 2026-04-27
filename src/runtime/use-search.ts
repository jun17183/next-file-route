'use client'

import { useSearchParams, usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { getSearchSchema, getRoutePath } from './manifest'
import { coerceSearchParams } from '../utils/zod-coerce'
import type { RoutePath } from '../types'

export function useSearch<P extends RoutePath = RoutePath>(path?: P) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return useMemo(() => {
    const routePath = path ?? getRoutePath(pathname) ?? pathname
    const schema = getSearchSchema(routePath as string)

    if (!schema || typeof schema !== 'object' || !('parse' in (schema as any))) {
      return {} as any
    }

    const raw: Record<string, string | string[]> = {}
    searchParams.forEach((value, key) => {
      const existing = raw[key]
      if (existing) {
        raw[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
      } else {
        raw[key] = value
      }
    })

    const coerced = coerceSearchParams(raw, schema)

    try {
      return (schema as any).parse(coerced)
    } catch (parseErr) {
      if (process.env.NODE_ENV !== 'production') {
        const route = (path ?? getRoutePath(pathname) ?? pathname) as string
        console.warn(
          `[next-file-route] useSearch: schema validation failed for "${route}", ` +
            'falling back to schema defaults.',
          parseErr,
        )
      }
      try {
        return (schema as any).parse({})
      } catch {
        return {} as any
      }
    }
  }, [path, pathname, searchParams])
}
