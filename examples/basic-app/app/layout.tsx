import type { ReactNode } from 'react'
import { route } from 'next-file-route/server'

const r = route({
  meta: {
    title: 'next-file-route example',
    description: 'A minimal Next.js app exercising the metadata platform.',
  },
})

export const generateMetadata = r.generateMetadata

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
