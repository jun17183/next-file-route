import { route } from 'next-file-route/server'
import { z } from 'zod'

const r = route({
  meta: {
    title: 'Post',
    section: 'public',
  },
  search: z.object({
    preview: z.boolean().default(false),
  }),
})

export const generateMetadata = r.generateMetadata

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <main>
      <h1>Post #{id}</h1>
    </main>
  )
}
