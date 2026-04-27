import { route } from 'next-file-route/server'

const r = route({
  meta: { title: 'Post Detail' },
})

export const generateMetadata = r.generateMetadata

export default function Page() {
  return <div>Post</div>
}
