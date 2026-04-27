import { route } from 'next-file-route/server'

const r = route({
  meta: { title: 'Root Layout' },
})

export const generateMetadata = r.generateMetadata

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>
}
