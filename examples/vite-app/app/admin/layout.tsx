import { route } from 'next-file-route/server'

export const r = route({
  meta: {
    title: 'Admin',
    section: 'admin',
    roles: ['admin'],
  },
})
