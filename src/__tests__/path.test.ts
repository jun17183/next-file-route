import { describe, it, expect } from 'vitest'
import { filePathToRoutePath, isRouteFile, matchRoute } from '../utils/path'

describe('filePathToRoutePath', () => {
  it('converts root page', () => {
    expect(filePathToRoutePath('app/page.tsx')).toBe('/')
  })

  it('converts nested page', () => {
    expect(filePathToRoutePath('app/admin/users/page.tsx')).toBe('/admin/users')
  })

  it('preserves dynamic segments', () => {
    expect(filePathToRoutePath('app/posts/[id]/page.tsx')).toBe('/posts/[id]')
  })

  it('preserves catch-all segments', () => {
    expect(filePathToRoutePath('app/posts/[...slug]/page.tsx')).toBe(
      '/posts/[...slug]',
    )
  })

  it('removes route groups', () => {
    expect(filePathToRoutePath('app/(marketing)/about/page.tsx')).toBe('/about')
  })

  it('removes nested route groups', () => {
    expect(
      filePathToRoutePath('app/(auth)/(dashboard)/settings/page.tsx'),
    ).toBe('/settings')
  })

  it('handles layout files', () => {
    expect(filePathToRoutePath('app/admin/layout.tsx')).toBe('/admin')
  })

  it('handles root layout', () => {
    expect(filePathToRoutePath('app/layout.tsx')).toBe('/')
  })

  it('handles .js extensions', () => {
    expect(filePathToRoutePath('app/about/page.js')).toBe('/about')
  })

  it('handles .jsx extensions', () => {
    expect(filePathToRoutePath('app/about/page.jsx')).toBe('/about')
  })
})

describe('isRouteFile', () => {
  it('detects page files', () => {
    expect(isRouteFile('app/page.tsx')).toEqual({ kind: 'page' })
    expect(isRouteFile('app/admin/page.ts')).toEqual({ kind: 'page' })
    expect(isRouteFile('app/page.jsx')).toEqual({ kind: 'page' })
  })

  it('detects layout files', () => {
    expect(isRouteFile('app/layout.tsx')).toEqual({ kind: 'layout' })
    expect(isRouteFile('app/admin/layout.ts')).toEqual({ kind: 'layout' })
  })

  it('returns null for `.meta` sibling files (legacy pattern, no longer supported)', () => {
    expect(isRouteFile('app/page.meta.ts')).toBeNull()
    expect(isRouteFile('app/admin/layout.meta.ts')).toBeNull()
  })

  it('returns null for other files', () => {
    expect(isRouteFile('app/components/button.tsx')).toBeNull()
    expect(isRouteFile('app/utils/helpers.ts')).toBeNull()
  })
})

describe('matchRoute', () => {
  const routes = [
    '/',
    '/admin/users',
    '/posts/[id]',
    '/posts/[...slug]',
    '/about',
  ]

  it('matches exact routes', () => {
    expect(matchRoute('/', routes)).toBe('/')
    expect(matchRoute('/about', routes)).toBe('/about')
    expect(matchRoute('/admin/users', routes)).toBe('/admin/users')
  })

  it('matches dynamic segments', () => {
    expect(matchRoute('/posts/123', routes)).toBe('/posts/[id]')
    expect(matchRoute('/posts/hello-world', routes)).toBe('/posts/[id]')
  })

  it('matches catch-all segments', () => {
    expect(matchRoute('/posts/a/b/c', routes)).toBe('/posts/[...slug]')
  })

  it('catch-all requires at least one caught segment', () => {
    const withCatchAll = ['/blog', '/blog/[...slug]']
    expect(matchRoute('/blog', withCatchAll)).toBe('/blog')
    expect(matchRoute('/blog/x', withCatchAll)).toBe('/blog/[...slug]')
  })

  it('catch-all without exact static sibling does not match bare path', () => {
    const onlyCatchAll = ['/docs/[...slug]']
    expect(matchRoute('/docs', onlyCatchAll)).toBeNull()
    expect(matchRoute('/docs/intro', onlyCatchAll)).toBe('/docs/[...slug]')
  })

  it('returns null for unmatched paths', () => {
    expect(matchRoute('/nonexistent', routes)).toBeNull()
    expect(matchRoute('/admin/settings', routes)).toBeNull()
  })

  it('prefers static over dynamic', () => {
    const withStatic = ['/posts/featured', '/posts/[id]']
    expect(matchRoute('/posts/featured', withStatic)).toBe('/posts/featured')
    expect(matchRoute('/posts/other', withStatic)).toBe('/posts/[id]')
  })

  describe('optional catch-all [[...slug]]', () => {
    const onlyOptional = ['/docs/[[...slug]]']

    it('matches the bare base path (zero captured segments)', () => {
      expect(matchRoute('/docs', onlyOptional)).toBe('/docs/[[...slug]]')
    })

    it('matches one or more captured segments', () => {
      expect(matchRoute('/docs/intro', onlyOptional)).toBe('/docs/[[...slug]]')
      expect(matchRoute('/docs/a/b/c', onlyOptional)).toBe('/docs/[[...slug]]')
    })

    it('does not match unrelated paths', () => {
      expect(matchRoute('/other', onlyOptional)).toBeNull()
    })

    it('static / dynamic / required catch-all all win over optional catch-all', () => {
      const mixed = [
        '/docs/intro',
        '/docs/[id]',
        '/docs/[...slug]',
        '/docs/[[...slug]]',
      ]
      expect(matchRoute('/docs/intro', mixed)).toBe('/docs/intro')
      expect(matchRoute('/docs/getting-started', mixed)).toBe('/docs/[id]')
      expect(matchRoute('/docs/a/b', mixed)).toBe('/docs/[...slug]')
    })

    it('matches the bare base path even when a sibling optional catch-all is the only viable pattern', () => {
      expect(matchRoute('/docs', ['/docs/[[...slug]]', '/about'])).toBe(
        '/docs/[[...slug]]',
      )
    })
  })
})
