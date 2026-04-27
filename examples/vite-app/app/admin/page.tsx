import { route } from 'next-file-route/server'

route({
  meta: {
    title: 'Admin home',
    roles: ['admin', 'manager'],
  },
})
