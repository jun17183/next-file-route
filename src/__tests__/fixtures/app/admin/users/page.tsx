import { route } from 'next-file-route/server'

const r = route({
  meta: { title: 'Users', roles: ['admin'] },
})

export const generateMetadata = r.generateMetadata

export default function Page() {
  return <div>Users</div>
}
