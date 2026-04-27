import { defineConfig } from 'tsup'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8'),
) as { version: string }

const versionDefine = {
  __PKG_VERSION__: JSON.stringify(pkg.version),
}

const outExtension = ({ format }: { format: string }) => ({
  js: format === 'esm' ? '.mjs' : '.cjs',
})

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outExtension,
    external: [
      'next',
      'react',
      'react-dom',
      'zod',
      'next-file-route/.generated/manifest',
    ],
    banner: { js: "'use client';" },
  },
  {
    entry: { server: 'src/server.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outExtension,
    external: [
      'next',
      'react',
      'zod',
      'next-file-route/.generated/manifest',
    ],
  },
  {
    entry: { plugin: 'src/plugin.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    outExtension,
    external: ['next', 'webpack', 'chokidar', '@swc/core'],
    platform: 'node',
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    sourcemap: true,
    outExtension,
    platform: 'node',
    external: ['@swc/core'],
    define: versionDefine,
    async onSuccess() {
      const { readFileSync, writeFileSync } = await import('fs')
      const cli = readFileSync('dist/cli.mjs', 'utf-8')
      if (!cli.startsWith('#!')) {
        writeFileSync('dist/cli.mjs', `#!/usr/bin/env node\n${cli}`)
      }
    },
  },
])
