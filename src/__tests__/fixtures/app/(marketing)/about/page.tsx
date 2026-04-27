import { route } from 'next-file-route/server'

const r = route({
  meta: { title: 'About' },
})

export const generateMetadata = r.generateMetadata

export default function Page() {
  return <div>About</div>
}
