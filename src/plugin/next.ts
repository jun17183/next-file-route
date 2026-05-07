import { resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { NextConfig } from 'next'
import type { PluginOptions } from '../types'
import { FileRouteWebpackPlugin } from './webpack'
import { scanRoutes, type ScanResult } from './scan'
import { emitManifestModule, emitRouteTypes } from './emit'

const DEFAULT_INCLUDE = ['app/**/{page,layout}.{ts,tsx,js,jsx}']
const GENERATED_REL_DIR = 'node_modules/next-file-route/.generated'

export function withFileRoute(
  config: NextConfig,
  options?: PluginOptions,
): NextConfig {
  const requireConfig = options?.requireConfig ?? false
  const include = options?.include ?? DEFAULT_INCLUDE
  const root = process.cwd()

  const initial = scanRoutes({ root, include, requireConfig })
  writeOutputs(root, initial)

  return {
    ...config,
    turbopack: { ...(config.turbopack ?? {}) },
    webpack(webpackConfig, context) {
      const userWebpackConfig =
        typeof config.webpack === 'function'
          ? config.webpack(webpackConfig, context)
          : webpackConfig

      userWebpackConfig.plugins = userWebpackConfig.plugins || []
      userWebpackConfig.plugins.push(
        new FileRouteWebpackPlugin({
          requireConfig,
          include,
        }),
      )

      return userWebpackConfig
    },
  }
}

function writeOutputs(root: string, state: ScanResult) {
  const dir = resolve(root, GENERATED_REL_DIR)
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'routes.d.ts'), emitRouteTypes(state.routeToFile, state.manifest.routes), 'utf-8')
  writeFileSync(
    resolve(dir, 'manifest.mjs'),
    emitManifestModule(state.manifest, {
      searchRoutes: state.searchRoutes,
      callSearchSources: state.callSearchSources,
    }),
    'utf-8',
  )
}
