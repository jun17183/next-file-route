export { withFileRoute } from './plugin/next'
export { fileRouteVite } from './plugin/vite'
export type { FileRouteViteOptions } from './plugin/vite'
export { FileRouteWebpackPlugin } from './plugin/webpack'

export { scanRoutes, scanRouteFile } from './plugin/scan'
export { readSourceFiles } from './plugin/read'
export { parseSource } from './plugin/parse'
export { extractRouteCall } from './plugin/extract'
export { buildManifest } from './plugin/build-manifest'
export { emitManifestModule, emitRouteTypes } from './plugin/emit'

export type { PluginOptions } from './types'
