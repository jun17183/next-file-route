import { route } from 'next-file-route/server'

export const r = route({
  meta: {
    title: 'User detail',
    roles: ['admin'],
  },
})

export const generateMetadata = r.generateMetadata

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <main>
      <h1>User #{id}</h1>
    </main>
  )
}
