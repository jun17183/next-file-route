import { resolve, relative } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { PluginOptions } from '../types'
import { scanRoutes, scanRouteFile } from './scan'
import type { ScanResult } from './scan'
import { emitManifestModule, emitRouteTypes } from './emit'

interface VitePlugin {
  name: string
  enforce?: 'pre' | 'post'
  config?: (config: unknown) => unknown
  configResolved?: (config: unknown) => void | Promise<void>
  configureServer?: (server: unknown) => void
  buildStart?: () => void | Promise<void>
}

export interface FileRouteViteOptions extends PluginOptions {
  root?: string
}

const GENERATED_REL_DIR = 'node_modules/next-file-route/.generated'
const MANIFEST_SPECIFIER = 'next-file-route/.generated/manifest'
const DEFAULT_INCLUDE = ['app/**/{page,layout}.{ts,tsx,js,jsx}']

export function fileRouteVite(options: FileRouteViteOptions = {}): VitePlugin {
  const root = options.root ?? process.cwd()
  const include = options.include ?? DEFAULT_INCLUDE
  const requireConfig = options.requireConfig ?? false

  const initial = scanRoutes({ root, include, requireConfig })
  writeOutputs(root, initial)

  const aliasObject = {
    [MANIFEST_SPECIFIER]: resolve(root, GENERATED_REL_DIR, 'manifest.mjs'),
  }

  return {
    name: 'next-file-route',
    enforce: 'pre',
    config(viteConfig: any) {
      const existing = viteConfig?.resolve?.alias ?? {}
      return {
        resolve: {
          alias: Array.isArray(existing)
            ? [
                ...existing,
                ...Object.entries(aliasObject).map(([find, replacement]) => ({
                  find,
                  replacement,
                })),
              ]
            : { ...existing, ...aliasObject },
        },
      }
    },
    configureServer(server: any) {
      const state: WritableManifestState = {
        manifest: initial.manifest,
        routeToFile: initial.routeToFile,
        layoutToFile: initial.layoutToFile,
        searchRoutes: initial.searchRoutes,
        callSearchSources: initial.callSearchSources,
        exportedNames: initial.exportedNames,
      }
      const watcher = server?.watcher
      if (!watcher) return

      const onChange = (absPath: string) => {
        const relPath = relative(root, absPath).replace(/\\/g, '/')
        const update = scanRouteFile(relPath, root)
        if (!update) return
        applyUpdateToState(state, relPath, update)
        try {
          writeOutputs(root, state)
        } catch (err) {
          server?.config?.logger?.warn?.(
            `[next-file-route] failed to write outputs: ${String(err)}`,
          )
        }
      }
      const onUnlink = (absPath: string) => {
        const relPath = relative(root, absPath).replace(/\\/g, '/')
        removeFromState(state, relPath)
        try {
          writeOutputs(root, state)
        } catch {
          // ignore
        }
      }

      watcher.on('change', onChange)
      watcher.on('add', onChange)
      watcher.on('unlink', onUnlink)
    },
  }
}

type WritableManifestState = Pick<
  ScanResult,
  | 'manifest'
  | 'routeToFile'
  | 'layoutToFile'
  | 'searchRoutes'
  | 'callSearchSources'
  | 'exportedNames'
>

function writeOutputs(root: string, state: WritableManifestState) {
  const dir = resolve(root, GENERATED_REL_DIR)
  mkdirSync(dir, { recursive: true })

  writeFileSync(
    resolve(dir, 'routes.d.ts'),
    emitRouteTypes(state.routeToFile, state.manifest.routes, {
      exportedNames: state.exportedNames,
    }),
    'utf-8',
  )

  const manifestSrc = emitManifestModule(state.manifest, {
    searchRoutes: state.searchRoutes,
    callSearchSources: state.callSearchSources,
  })
  writeFileSync(resolve(dir, 'manifest.mjs'), manifestSrc, 'utf-8')
}

function applyUpdateToState(
  state: WritableManifestState,
  relPath: string,
  update: {
    fileType: 'page' | 'layout'
    routePath: string
    result: {
      value: Record<string, unknown> | null
      hasSearch: boolean
      searchSource: string | null
      exportedName: string | null
    }
  },
) {
  const { routePath, fileType, result } = update

  if (fileType === 'page') {
    if (result.value) {
      state.manifest.routes[routePath] = result.value
      state.routeToFile.set(routePath, relPath)
      if (result.hasSearch && result.searchSource) {
        state.searchRoutes.add(routePath)
        state.callSearchSources.set(routePath, result.searchSource)
      } else {
        state.searchRoutes.delete(routePath)
        state.callSearchSources.delete(routePath)
      }
      if (result.exportedName) {
        state.exportedNames.set(routePath, result.exportedName)
      } else {
        state.exportedNames.delete(routePath)
      }
    } else {
      delete state.manifest.routes[routePath]
      state.routeToFile.delete(routePath)
      state.searchRoutes.delete(routePath)
      state.callSearchSources.delete(routePath)
      state.exportedNames.delete(routePath)
    }
  } else {
    if (result.value) {
      state.manifest.layouts[routePath] = result.value
      state.layoutToFile.set(routePath, relPath)
    } else {
      delete state.manifest.layouts[routePath]
      state.layoutToFile.delete(routePath)
    }
  }
}

function removeFromState(state: WritableManifestState, relPath: string) {
  for (const [rp, fp] of state.routeToFile) {
    if (fp === relPath) {
      delete state.manifest.routes[rp]
      state.routeToFile.delete(rp)
      state.searchRoutes.delete(rp)
      state.callSearchSources.delete(rp)
      state.exportedNames.delete(rp)
      break
    }
  }
  for (const [rp, fp] of state.layoutToFile) {
    if (fp === relPath) {
      delete state.manifest.layouts[rp]
      state.layoutToFile.delete(rp)
      break
    }
  }
}
