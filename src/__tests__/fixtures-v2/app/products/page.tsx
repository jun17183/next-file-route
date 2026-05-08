import { route } from 'next-file-route/server'
import { z } from 'zod'

export const r = route({
  meta: { title: 'Products' },
  search: z.object({
    page: z.number().default(1),
    sort: z.enum(['asc', 'desc']).default('asc'),
    q: z.string().optional(),
  }),
})

export const generateMetadata = r.generateMetadata

export default function Page() {
  return <div>Products</div>
}
