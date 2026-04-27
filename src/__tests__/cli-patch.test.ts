import { describe, it, expect } from 'vitest'
import { patchNextConfig } from '../cli/patch-config'

describe('patchNextConfig (ESM)', () => {
  it('wraps a simple identifier export', () => {
    const src = [
      '/** @type {import("next").NextConfig} */',
      'const nextConfig = { reactStrictMode: true }',
      '',
      'export default nextConfig',
      '',
    ].join('\n')

    const out = patchNextConfig(src, true)!
    expect(out).toContain("import { withFileRoute } from 'next-file-route/plugin'")
    expect(out).toContain('export default withFileRoute(nextConfig)')
    expect(out).not.toContain('export default nextConfig\n')
  })

  it('extracts and wraps a multi-line inline object literal', () => {
    const src = [
      'export default {',
      '  reactStrictMode: true,',
      '  images: { domains: ["example.com"] },',
      '}',
      '',
    ].join('\n')

    const out = patchNextConfig(src, true)!
    expect(out).toContain("import { withFileRoute } from 'next-file-route/plugin'")
    expect(out).toContain('const __nextFileRouteConfig = {')
    expect(out).toContain('export default withFileRoute(__nextFileRouteConfig)')
    expect(out).not.toMatch(/withFileRoute\(\{\)/)
  })

  it('does not corrupt nested braces inside the inline object', () => {
    const src = [
      'export default {',
      '  experimental: {',
      '    serverActions: { bodySizeLimit: "2mb" },',
      '  },',
      '}',
      '',
    ].join('\n')

    const out = patchNextConfig(src, true)!
    expect(out).toContain('serverActions: { bodySizeLimit: "2mb" }')
    expect(out).toContain('export default withFileRoute(__nextFileRouteConfig)')
  })
})

describe('patchNextConfig (CJS)', () => {
  it('wraps a simple identifier assignment', () => {
    const src = [
      'const nextConfig = { reactStrictMode: true }',
      'module.exports = nextConfig',
      '',
    ].join('\n')

    const out = patchNextConfig(src, false)!
    expect(out).toContain("const { withFileRoute } = require('next-file-route/plugin')")
    expect(out).toContain('module.exports = withFileRoute(nextConfig)')
  })

  it('extracts and wraps an inline object', () => {
    const src = [
      'module.exports = {',
      '  reactStrictMode: true,',
      '}',
      '',
    ].join('\n')

    const out = patchNextConfig(src, false)!
    expect(out).toContain('const __nextFileRouteConfig = {')
    expect(out).toContain('module.exports = withFileRoute(__nextFileRouteConfig)')
  })
})

describe('patchNextConfig — unrecognized shapes', () => {
  it('returns null for files with no default export', () => {
    expect(patchNextConfig('export const foo = 1\n', true)).toBeNull()
    expect(patchNextConfig('const x = 1\n', false)).toBeNull()
  })
})
