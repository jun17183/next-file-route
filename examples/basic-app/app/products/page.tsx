import { route, parseSearch } from 'next-file-route/server'
import { z } from 'zod'

const r = route({
  meta: {
    title: 'Products',
    section: 'public',
  },
  search: z.object({
    page: z.number().default(1),
    sort: z.enum(['asc', 'desc']).default('asc'),
    q: z.string().optional(),
  }),
})

export const generateMetadata = r.generateMetadata

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>
}) {
  const params = (await parseSearch('/products', searchParams)) as {
    page: number
    sort: 'asc' | 'desc'
    q?: string
  }
  return (
    <main>
      <h1>Products</h1>
      <pre>{JSON.stringify(params, null, 2)}</pre>
    </main>
  )
}
