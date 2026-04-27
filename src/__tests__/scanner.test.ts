import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { scanRoutes } from '../plugin/scan'

const FIXTURES = resolve(__dirname, 'fixtures')

describe('scan', () => {
  it('builds manifest from fixture app directory', () => {
    const result = scanRoutes({ root: FIXTURES })

    expect(result.warnings).toHaveLength(0)
    expect(result.files.length).toBeGreaterThanOrEqual(5)

    expect(result.manifest.routes['/']).toEqual({
      meta: { title: 'Home' },
    })
    expect(result.manifest.routes['/admin/users']).toEqual({
      meta: { title: 'Users', roles: ['admin'] },
    })
    expect(result.manifest.routes['/posts/[id]']).toEqual({
      meta: { title: 'Post Detail' },
    })
    expect(result.manifest.routes['/about']).toEqual({
      meta: { title: 'About' },
    })

    expect(result.manifest.layouts['/']).toEqual({
      meta: { title: 'Root Layout' },
    })
  })

  it('does not warn when fixtures have all required configs', () => {
    const result = scanRoutes({ root: FIXTURES, requireConfig: false })
    expect(result.warnings).toHaveLength(0)
  })
})
