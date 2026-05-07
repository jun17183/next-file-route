#!/usr/bin/env node
/**
 * Integration smoke test.
 *
 * Runs the built CLI against `examples/basic-app/` and asserts that the
 * generated manifest and .d.ts contain the routes/types we expect. Avoids
 * spinning up a full `next build` so the test is fast and CI-friendly.
 *
 * Run after `npm run build`.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const exampleRoot = resolve(repoRoot, 'examples/basic-app')
const generatedDir = resolve(exampleRoot, 'node_modules/next-file-route/.generated')

let failures = 0
function assert(cond, message) {
  if (cond) {
    console.log(`  ✓ ${message}`)
  } else {
    failures++
    console.error(`  ✗ ${message}`)
  }
}

function section(title) {
  console.log(`\n[${title}]`)
}

section('Setup')
// Make sure node_modules/next-file-route/.generated exists; the CLI will
// write into it. We don't run `npm install` here — the file paths the CLI
// writes are independent of npm's link state.
rmSync(generatedDir, { recursive: true, force: true })
mkdirSync(generatedDir, { recursive: true })
console.log(`  Cleared ${generatedDir}`)

section('Run CLI sync')
const cliPath = resolve(repoRoot, 'dist/cli.mjs')
const result = spawnSync('node', [cliPath, 'sync', '--root', exampleRoot], {
  encoding: 'utf-8',
})
console.log(result.stdout?.trim())
if (result.stderr) console.error(result.stderr.trim())
assert(result.status === 0, `CLI exits 0 (got ${result.status})`)

section('routes.d.ts contents')
const dtsPath = resolve(generatedDir, 'routes.d.ts')
const dts = readFileSync(dtsPath, 'utf-8')

// `/admin` is declared in app/admin/layout.tsx (not page.tsx — the page is a
// 'use client' component), so it appears in __layouts, not __routes/RouteMap.
const expectedDtsRoutes = [
  '"/"',
  '"/about"',
  '"/admin/users"',
  '"/admin/users/[id]"',
  '"/posts/[id]"',
  '"/products"',
]
for (const path of expectedDtsRoutes) {
  assert(dts.includes(`${path}: {`), `RouteMap entry for ${path}`)
}
assert(!dts.includes('"/admin":'), '/admin (layout-only) absent from RouteMap')
assert(dts.includes("declare module 'next-file-route'"), 'declares next-file-route module')
assert(dts.includes('interface RouteMap'), 'declares RouteMap interface')

// Phase 1 — literal types should land in the .d.ts.
assert(dts.includes('readonly title: "Users"'), '/admin/users meta.title literal')
assert(
  dts.includes('readonly roles: readonly ["admin", "manager"]'),
  '/admin/users meta.roles readonly tuple',
)
assert(dts.includes('readonly search: unknown'), '/products search marker emitted as unknown')

section('manifest.mjs contents')
const manifestPath = resolve(generatedDir, 'manifest.mjs')
const manifest = readFileSync(manifestPath, 'utf-8')

assert(manifest.includes('export const __routes'), 'exports __routes')
assert(manifest.includes('export const __layouts'), 'exports __layouts')
assert(manifest.includes('export const __searchSchemas'), 'exports __searchSchemas')
assert(manifest.includes('export function __matchRoute'), 'exports __matchRoute')

// Routes declared via `route({ search: z.object(...) })` (the 'call' pattern)
// have their schema source sliced from page.tsx and inlined into the manifest
// as `const __inline_search_N = ...` + a top-level `import { z } from 'zod'`.
// This avoids pulling page.tsx into a 'use client' boundary just to reach the
// schema. Examples/basic-app uses 'call' for every searchable route.
assert(
  manifest.includes("import { z } from 'zod'"),
  'imports zod for inlined search schemas',
)
assert(
  manifest.includes('const __inline_search_'),
  'inlines Zod schemas as __inline_search_N consts',
)
assert(!manifest.includes('"__ZOD_SCHEMA__"'), 'strips ZOD_SCHEMA_MARKER from JSON')

// Specific route titles survived static extraction
assert(manifest.includes('"Home"'), 'extracts "Home" title')
assert(manifest.includes('"User detail"'), 'extracts "User detail" title')
assert(manifest.includes('"Team"'), 'extracts "Team" breadcrumb override')

// Roles array preserved on the protected admin routes
assert(manifest.includes('"admin"'), 'extracts admin role')
assert(manifest.includes('"manager"'), 'extracts manager role')

section('Manifest module structure')
// Load the bootstrap (no .tsx imports) to verify __matchRoute is wired up.
// We can't import the example manifest in raw Node because it imports .tsx
// pages — that's a bundler responsibility. Instead, regex-check the pattern
// list that will be passed to __matchRoute at runtime.
// The pattern list embedded in __matchRoute is the JSON.stringify output of
// `Object.keys(routes)`. We capture up to `];\n` to avoid stopping at inner
// `]` characters (dynamic segments like `[id]`).
const patternListMatch = manifest.match(/const routes = (\[[\s\S]*?\]);/)
assert(patternListMatch !== null, '__matchRoute embeds the route pattern list')
if (patternListMatch) {
  const patterns = JSON.parse(patternListMatch[1])
  assert(patterns.includes('/admin/users/[id]'), 'pattern list includes /admin/users/[id]')
  assert(patterns.includes('/posts/[id]'), 'pattern list includes /posts/[id]')
  assert(patterns.includes('/'), 'pattern list includes /')
}

section('Result')
if (failures === 0) {
  console.log(`\nAll smoke checks passed.`)
  process.exit(0)
} else {
  console.error(`\n${failures} smoke check(s) failed.`)
  process.exit(1)
}
