import { cac } from 'cac'
import { resolve, relative } from 'node:path'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { scanRoutes, scanRouteFile, type ScanResult } from './plugin/scan'
import { emitManifestModule, emitRouteTypes } from './plugin/emit'
import { patchNextConfig } from './cli/patch-config'

declare const __PKG_VERSION__: string
const PKG_VERSION =
  typeof __PKG_VERSION__ === 'string' ? __PKG_VERSION__ : '0.0.0-dev'

const GENERATED_DIR = 'node_modules/next-file-route/.generated'

type WritableManifestState = Pick<
  ScanResult,
  | 'manifest'
  | 'routeToFile'
  | 'layoutToFile'
  | 'searchRoutes'
  | 'callSearchSources'
  | 'exportedNames'
>

function writeGeneratedOutputs(root: string, state: WritableManifestState) {
  const dir = resolve(root, GENERATED_DIR)
  mkdirSync(dir, { recursive: true })

  writeFileSync(
    resolve(dir, 'routes.d.ts'),
    emitRouteTypes(state.routeToFile, state.manifest.routes, {
      exportedNames: state.exportedNames,
    }),
    'utf-8',
  )

  const manifest = emitManifestModule(state.manifest, {
    searchRoutes: state.searchRoutes,
    callSearchSources: state.callSearchSources,
  })
  writeFileSync(resolve(dir, 'manifest.mjs'), manifest, 'utf-8')
}

const cli = cac('next-file-route')

cli
  .command('sync', 'Scan and regenerate manifest + types')
  .option('--root <dir>', 'Project root', { default: '.' })
  .action((options) => {
    const root = resolve(options.root)
    console.log(`[next-file-route] Scanning ${root}...`)

    const result = scanRoutes({ root })

    let hasWarning = false
    for (const w of result.warnings) {
      hasWarning = true
      console.warn(`  WARN ${w.file}: ${w.message}`)
      if (w.hint) console.warn(`    Hint: ${w.hint}`)
    }

    writeGeneratedOutputs(root, result)

    const routeCount = Object.keys(result.manifest.routes).length
    const layoutCount = Object.keys(result.manifest.layouts).length
    console.log(
      `[next-file-route] Done. ${routeCount} route(s), ${layoutCount} layout(s).`,
    )

    process.exit(hasWarning ? 1 : 0)
  })

cli
  .command(
    'init',
    'Add withFileRoute wrapper to next.config and run first sync',
  )
  .option('--root <dir>', 'Project root', { default: '.' })
  .action((options) => {
    const root = resolve(options.root)

    const configNames = [
      'next.config.mjs',
      'next.config.js',
      'next.config.ts',
    ]
    let configPath: string | null = null
    for (const name of configNames) {
      const p = resolve(root, name)
      if (existsSync(p)) {
        configPath = p
        break
      }
    }

    if (!configPath) {
      console.error(
        '[next-file-route] Could not find next.config.{js,mjs,ts}. Create one first.',
      )
      process.exit(2)
    }

    const content = readFileSync(configPath, 'utf-8')

    if (content.includes('withFileRoute')) {
      console.log(
        '[next-file-route] withFileRoute already present. Skipping config patch.',
      )
    } else {
      const isESM =
        configPath.endsWith('.mjs') || configPath.endsWith('.ts')

      const patched = patchNextConfig(content, isESM)
      if (!patched) {
        console.error(
          '[next-file-route] Could not auto-patch the config. Wrap your default export manually:\n' +
            "  import { withFileRoute } from 'next-file-route/plugin'\n" +
            '  export default withFileRoute(yourConfig)',
        )
        process.exit(2)
      }

      writeFileSync(configPath, patched, 'utf-8')
      console.log(`[next-file-route] Patched ${configPath}`)
    }

    console.log('[next-file-route] Running first sync...')
    const result = scanRoutes({ root })
    writeGeneratedOutputs(root, result)

    const routeCount = Object.keys(result.manifest.routes).length
    console.log(`[next-file-route] Init complete. ${routeCount} route(s) found.`)
  })

cli
  .command(
    'watch',
    'Standalone file watcher — regenerate manifest on every change. ' +
      'Use this with Turbopack / Vite / Rspack, where there is no plugin hook.',
  )
  .option('--root <dir>', 'Project root', { default: '.' })
  .option('--include <glob...>', 'Glob patterns', {
    default: ['app/**/{page,layout}.{ts,tsx,js,jsx}'],
  })
  .action(async (options) => {
    const root = resolve(options.root)
    const include: string[] = Array.isArray(options.include)
      ? options.include
      : [options.include]

    console.log(`[next-file-route] Initial scan in ${root}...`)
    const initial = scanRoutes({ root, include })
    writeGeneratedOutputs(root, initial)
    const initialCount = Object.keys(initial.manifest.routes).length
    console.log(
      `[next-file-route] Watching for changes — ${initialCount} route(s) loaded.`,
    )

    const { watch } = await import('chokidar')
    const patterns = include.map((p) => resolve(root, p))
    const watcher = watch(patterns, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    })

    const state: WritableManifestState = {
      manifest: initial.manifest,
      routeToFile: initial.routeToFile,
      layoutToFile: initial.layoutToFile,
      searchRoutes: initial.searchRoutes,
      callSearchSources: initial.callSearchSources,
      exportedNames: initial.exportedNames,
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleRebuild = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        try {
          writeGeneratedOutputs(root, state)
          const count = Object.keys(state.manifest.routes).length
          console.log(`[next-file-route] Manifest updated — ${count} route(s).`)
        } catch (e) {
          console.warn('[next-file-route] Failed to write manifest:', e)
        }
      }, 50)
    }

    const toRel = (absPath: string) =>
      relative(root, absPath).replace(/\\/g, '/')

    const onChange = (absPath: string) => {
      const relPath = toRel(absPath)
      const update = scanRouteFile(relPath, root)
      if (!update) return
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

      for (const w of result.warnings) {
        console.warn(`[next-file-route] ${w.file}: ${w.message}`)
      }
      scheduleRebuild()
    }

    const onUnlink = (absPath: string) => {
      const relPath = toRel(absPath)
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
      scheduleRebuild()
    }

    watcher.on('change', onChange)
    watcher.on('add', onChange)
    watcher.on('unlink', onUnlink)

    const shutdown = async () => {
      console.log('\n[next-file-route] Stopping watcher...')
      if (timer) clearTimeout(timer)
      try {
        await watcher.close()
      } catch {
        // ignore
      }
      process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  })

cli
  .command('inspect', 'Print current manifest as JSON')
  .option('--root <dir>', 'Project root', { default: '.' })
  .action((options) => {
    const root = resolve(options.root)
    const result = scanRoutes({ root })

    console.log(
      JSON.stringify(
        {
          routes: result.manifest.routes,
          layouts: result.manifest.layouts,
        },
        null,
        2,
      ),
    )
  })

cli.help()
cli.version(PKG_VERSION)
cli.parse()
