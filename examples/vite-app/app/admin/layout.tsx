import { route } from 'next-file-route/server'

route({
  meta: {
    title: 'Admin',
    section: 'admin',
    roles: ['admin'],
  },
})
