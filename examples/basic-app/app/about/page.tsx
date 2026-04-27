import { route } from 'next-file-route/server'

const r = route({
  meta: {
    title: 'About',
    breadcrumb: 'About us',
    section: 'public',
  },
})

export const generateMetadata = r.generateMetadata

export default function AboutPage() {
  return (
    <main>
      <h1>About</h1>
    </main>
  )
}
