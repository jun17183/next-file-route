import { route } from 'next-file-route/server'
import { z } from 'zod'

export const r = route({
  meta: {
    title: 'Users',
    breadcrumb: 'Team',
    roles: ['admin', 'manager'],
  },
  search: z.object({
    page: z.number().default(1),
    sort: z.enum(['name', 'created']).default('name'),
    q: z.string().optional(),
  }),
})

export const generateMetadata = r.generateMetadata

export default function UsersPage() {
  return (
    <main>
      <h1>Users</h1>
    </main>
  )
}
