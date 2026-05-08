import type { ReactNode } from 'react'
import { route } from 'next-file-route/server'

export const r = route({
  meta: {
    title: 'Admin',
    section: 'admin',
  },
})

export const generateMetadata = r.generateMetadata

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <section>{children}</section>
}
