import { route, getRoutes } from 'next-file-route/server'

export const r = route({
  meta: {
    title: 'Home',
    description: 'Welcome to the example app.',
    section: 'public',
  },
})

export const generateMetadata = r.generateMetadata

export default function HomePage() {
  const routes = getRoutes()
  return (
    <main>
      <h1>Home</h1>
      <pre>{JSON.stringify(routes, null, 2)}</pre>
    </main>
  )
}
