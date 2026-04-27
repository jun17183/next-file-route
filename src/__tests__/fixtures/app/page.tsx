import { route } from 'next-file-route/server'

const r = route({
  meta: { title: 'Home' },
})

export const generateMetadata = r.generateMetadata

export default function Page() {
  return <main>Home</main>
}
