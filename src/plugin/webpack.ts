import { resolve, relative } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Compiler } from 'webpack'
import { scanRoutes, scanRouteFile } from './scan'
import { emitManifestModule, emitRouteTypes } from './emit'
import type { Manifest } from '../types'

const GENERATED_REL_DIR = 'node_modules/next-file-route/.generated'

export interface FileRoutePluginOptions {
  requireConfig: boolean
  include: string[]
}

interface FileWatcher {
  close(): Promise<void> | void
  on(event: 'change' | 'add' | 'unlink', listener: (path: string) => void): unknown
}

export class FileRouteWebpackPlugin {
  private options: FileRoutePluginOptions
  private manifest: Manifest = { routes: {}, layouts: {} }
  private routeToFile = new Map<string, string>()
  private layoutToFile = new Map<string, string>()
  private searchRoutes = new Set<string>()
  private callSearchSources = new Map<string, string>()
  private watcher: FileWatcher | null = null

  constructor(options: FileRoutePluginOptions) {
    this.options = options
  }

  apply(compiler: Compiler) {
    const root = compiler.context || process.cwd()

    excludeFromManagedPaths(compiler, resolve(root, GENERATED_REL_DIR))

    compiler.hooks.beforeCompile.tapAsync(
      'FileRouteWebpackPlugin',
      (_params, callback) => {
        try {
          this.fullScan(root)
        } catch (err) {
          console.error('[next-file-route] Scan failed:', err)
        }
        callback()
      },
    )

    const isDev = compiler.options.mode === 'development'
    if (isDev) {
      compiler.hooks.afterCompile.tapAsync(
        'FileRouteWebpackPlugin',
        (_compilation, callback) => {
          this.startWatcher(root)
          callback()
        },
      )
    }

    compiler.hooks.shutdown?.tapAsync(
      'FileRouteWebpackPlugin',
      (callback) => {
        this.stopWatcher()
        callback()
      },
    )
  }

  private fullScan(root: string) {
    const result = scanRoutes({
      root,
      include: this.options.include,
      requireConfig: this.options.requireConfig,
    })

    this.manifest = result.manifest
    this.routeToFile = result.routeToFile
    this.layoutToFile = result.layoutToFile
    this.searchRoutes = result.searchRoutes
    this.callSearchSources = result.callSearchSources

    for (const w of result.warnings) {
      const loc = w.line ? `:${w.line}` : ''
      console.warn(`[next-file-route] ${w.file}${loc}`)
      console.warn(`  ${w.message}`)
      if (w.hint) console.warn(`  Hint: ${w.hint}`)
    }

    this.writeOutputs(root)

    const routeCount = Object.keys(this.manifest.routes).length
    const layoutCount = Object.keys(this.manifest.layouts).length
    console.log(
      `[next-file-route] Found ${routeCount} route(s), ${layoutCount} layout(s)`,
    )
  }

  private writeOutputs(root: string) {
    const dir = resolve(root, GENERATED_REL_DIR)
    mkdirSync(dir, { recursive: true })

    writeFileSync(resolve(dir, 'routes.d.ts'), emitRouteTypes(this.routeToFile, this.manifest.routes), 'utf-8')

    const manifestSrc = emitManifestModule(this.manifest, {
      searchRoutes: this.searchRoutes,
      callSearchSources: this.callSearchSources,
    })
    writeFileSync(resolve(dir, 'manifest.mjs'), manifestSrc, 'utf-8')
  }

  private watcherStarting = false
  private updateTimer: ReturnType<typeof setTimeout> | null = null

  private toRelPath(absPath: string, root: string): string {
    return relative(root, absPath).replace(/\\/g, '/')
  }

  private startWatcher(root: string) {
    if (this.watcher || this.watcherStarting) return
    this.watcherStarting = true

    import('chokidar')
      .then(({ watch }) => {
        if (this.watcher) {
          this.watcherStarting = false
          return
        }

        const patterns = this.options.include.map((p) => resolve(root, p))
        const watcher = watch(patterns, {
          ignoreInitial: true,
          awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
        }) as unknown as FileWatcher
        this.watcher = watcher

        const scheduleRebuild = () => {
          if (this.updateTimer) clearTimeout(this.updateTimer)
          this.updateTimer = setTimeout(() => {
            try {
              this.writeOutputs(root)
            } catch (err) {
              console.warn('[next-file-route] Failed to write outputs:', err)
            }
          }, 50)
        }

        const handleChange = (absPath: string) => {
          const relPath = this.toRelPath(absPath, root)

          const update = scanRouteFile(relPath, root)
          if (!update) return
          const { routePath, fileType, result } = update

          if (fileType === 'page') {
            if (result.value) {
              this.manifest.routes[routePath] = result.value
              this.routeToFile.set(routePath, relPath)
              if (result.hasSearch && result.searchSource) {
                this.searchRoutes.add(routePath)
                this.callSearchSources.set(routePath, result.searchSource)
              } else {
                this.searchRoutes.delete(routePath)
                this.callSearchSources.delete(routePath)
              }
            } else {
              delete this.manifest.routes[routePath]
              this.routeToFile.delete(routePath)
              this.searchRoutes.delete(routePath)
              this.callSearchSources.delete(routePath)
            }
          } else {
            if (result.value) {
              this.manifest.layouts[routePath] = result.value
              this.layoutToFile.set(routePath, relPath)
            } else {
              delete this.manifest.layouts[routePath]
              this.layoutToFile.delete(routePath)
            }
          }

          for (const w of result.warnings) {
            console.warn(`[next-file-route] ${w.file}: ${w.message}`)
          }

          scheduleRebuild()
        }

        const handleUnlink = (absPath: string) => {
          const relPath = this.toRelPath(absPath, root)

          for (const [rp, fp] of this.routeToFile) {
            if (fp === relPath) {
              delete this.manifest.routes[rp]
              this.routeToFile.delete(rp)
              this.searchRoutes.delete(rp)
              this.callSearchSources.delete(rp)
              break
            }
          }
          for (const [rp, fp] of this.layoutToFile) {
            if (fp === relPath) {
              delete this.manifest.layouts[rp]
              this.layoutToFile.delete(rp)
              break
            }
          }

          scheduleRebuild()
        }

        watcher.on('change', handleChange)
        watcher.on('add', handleChange)
        watcher.on('unlink', handleUnlink)
        this.watcherStarting = false
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(
          `[next-file-route] Could not start file watcher: ${message}. ` +
            'Hot reload of route configs is disabled for this session.',
        )
        this.watcherStarting = false
      })
  }

  private stopWatcher() {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
      this.updateTimer = null
    }
    if (this.watcher) {
      const closeResult = this.watcher.close()
      if (closeResult && typeof (closeResult as Promise<void>).catch === 'function') {
        ;(closeResult as Promise<void>).catch(() => {})
      }
      this.watcher = null
    }
  }
}

// Webpack treats node_modules as immutable by default; without this our
// generated manifest writes wouldn't invalidate the module graph in dev.
function excludeFromManagedPaths(compiler: Compiler, generatedDir: string) {
  const snapshot = compiler.options.snapshot
  if (!snapshot) return

  const escaped = generatedDir.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  const exclusion = new RegExp(`^${escaped}(\\/|\\\\|$)`)

  for (const key of ['managedPaths', 'immutablePaths'] as const) {
    const set = snapshot[key]
    if (set instanceof Set) {
      set.add(exclusion)
    }
  }
}
