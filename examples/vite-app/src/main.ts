/**
 * Entry that pulls the runtime manifest into the bundle. If `fileRouteVite`
 * has wired the alias correctly, all four expected exports are present and
 * the search schemas resolve to live Zod instances rather than strings.
 */
import {
  __routes,
  __layouts,
  __searchSchemas,
  __matchRoute,
} from 'next-file-route/.generated/manifest'

console.log('routes:', Object.keys(__routes))
console.log('layouts:', Object.keys(__layouts))
console.log('search-schema routes:', Object.keys(__searchSchemas))
console.log('match("/products"):', __matchRoute('/products'))

// Exercise a search schema end-to-end.
const productsSchema = __searchSchemas['/products'] as
  | { parse(v: unknown): unknown }
  | undefined
if (productsSchema) {
  console.log(
    'parsed:',
    productsSchema.parse({ page: 2, sort: 'desc' }),
  )
}
