#!/usr/bin/env node
/**
 * Vite-adapter integration smoke test.
 *
 * Runs `vite build` against `examples/vite-app/` and asserts that the bundle
 * contains the expected runtime values — i.e., that `fileRouteVite` pinned
 * the manifest alias and the inlined Zod schemas survived the build.
 *
 * Run after `npm run build` (the lib build) AND after `npm install` in
 * `examples/vite-app/` (one-time setup).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const exampleRoot = resolve(repoRoot, 'examples/vite-app')

let failures = 0
function assert(cond, message) {
  if (cond) console.log(`  ✓ ${message}`)
  else {
    failures++
    console.error(`  ✗ ${message}`)
  }
}

function section(title) {
  console.log(`\n[${title}]`)
}

section('Setup')
if (!existsSync(resolve(exampleRoot, 'node_modules'))) {
  console.error(`  examples/vite-app has no node_modules. Run:`)
  console.error(`    cd examples/vite-app && npm install`)
  process.exit(2)
}
rmSync(resolve(exampleRoot, 'dist'), { recursive: true, force: true })
console.log(`  Cleared previous dist`)

section('Run vite build')
const npm = spawnSync('npm', ['run', 'build'], {
  cwd: exampleRoot,
  encoding: 'utf-8',
})
console.log(npm.stdout?.trim())
if (npm.stderr) console.error(npm.stderr.trim())
assert(npm.status === 0, `vite build exits 0 (got ${npm.status})`)

section('Run the bundled output and snapshot stdout')
const node = spawnSync('node', [resolve(exampleRoot, 'dist/main.js')], {
  encoding: 'utf-8',
})
const stdout = node.stdout?.trim() ?? ''
console.log(stdout)
assert(node.status === 0, `node dist/main.js exits 0`)

assert(stdout.includes("routes: [ '/', '/admin', '/products' ]"), 'manifest exposes /, /admin, /products')
assert(stdout.includes("layouts: [ '/admin' ]"), 'manifest exposes the admin layout')
assert(
  stdout.includes("search-schema routes: [ '/products' ]"),
  '/products carries a Zod search schema',
)
assert(stdout.includes("match(\"/products\"): /products"), '__matchRoute resolves /products')
assert(
  stdout.includes("parsed: { page: 2, sort: 'desc' }"),
  'inlined Zod schema parsed input — manifest end-to-end',
)

section('Confirm generated outputs')
const generated = resolve(exampleRoot, 'node_modules/next-file-route/.generated')
assert(existsSync(resolve(generated, 'manifest.mjs')), 'manifest.mjs generated')
assert(existsSync(resolve(generated, 'routes.d.ts')), 'routes.d.ts generated')

const manifest = readFileSync(resolve(generated, 'manifest.mjs'), 'utf-8')
assert(
  manifest.includes("import { z } from 'zod';"),
  'manifest pulls zod for inlined search schemas',
)
assert(
  manifest.includes('const __inline_search_'),
  'manifest inlines search schemas as __inline_search_N',
)
assert(
  !manifest.includes('next-file-route-meta/'),
  'manifest no longer references the legacy alias specifier',
)

section('Result')
if (failures === 0) {
  console.log(`\nAll Vite smoke checks passed.`)
  process.exit(0)
} else {
  console.error(`\n${failures} Vite smoke check(s) failed.`)
  process.exit(1)
}
