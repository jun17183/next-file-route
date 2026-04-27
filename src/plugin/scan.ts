import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { filePathToRoutePath, isRouteFile } from '../utils/path'
import { readSourceFiles } from './read'
import { parseSource } from './parse'
import { extractRouteCall, type ExtractionResult, type ExtractionWarning } from './extract'
import { buildManifest, type Extraction, type ManifestData } from './build-manifest'

export interface ScanOptions {
  root?: string
  include?: string[]
  requireConfig?: boolean
}

export interface ScanResult extends ManifestData {
  warnings: ExtractionWarning[]
  files: string[]
}

const DEFAULT_INCLUDE = ['app/**/{page,layout}.{ts,tsx,js,jsx}']

export function scanRoutes(options: ScanOptions = {}): ScanResult {
  const {
    root = process.cwd(),
    include = DEFAULT_INCLUDE,
    requireConfig = false,
  } = options

  const warnings: ExtractionWarning[] = []
  const extractions: Extraction[] = []
  const scannedFiles: string[] = []

  for (const file of readSourceFiles(root, include)) {
    const fileType = isRouteFile(file.relPath)
    if (!fileType) continue
    scannedFiles.push(file.relPath)

    const parsed = parseSource(file.source, file.relPath)
    if ('error' in parsed) {
      warnings.push({
        file: file.relPath,
        line: 0,
        column: 0,
        field: '',
        message: `Failed to parse file: ${parsed.error}`,
        hint: 'Check for syntax errors in this file.',
      })
      continue
    }

    const result = extractRouteCall(parsed.ast, file.source, file.relPath)
    warnings.push(...result.warnings)

    if (result.value === null) {
      if (requireConfig && fileType.kind === 'page') {
        warnings.push({
          file: file.relPath,
          line: 0,
          column: 0,
          field: 'route',
          message: `Missing required 'route()' call in ${file.relPath}.`,
          hint: `Add \`const r = route({ meta: { title: "..." } })\` and re-export r.generateMetadata.`,
        })
      }
      continue
    }

    extractions.push({
      relPath: file.relPath,
      routePath: filePathToRoutePath(file.relPath),
      kind: fileType.kind,
      result,
    })
  }

  return {
    ...buildManifest(extractions),
    warnings,
    files: scannedFiles,
  }
}

export interface ScanRouteFileResult {
  routePath: string
  fileType: 'page' | 'layout'
  result: ExtractionResult
}

export function scanRouteFile(
  filePath: string,
  root: string,
): ScanRouteFileResult | null {
  const fileType = isRouteFile(filePath)
  if (!fileType) return null

  let source: string
  try {
    source = readFileSync(resolve(root, filePath), 'utf-8')
  } catch {
    return null
  }

  const parsed = parseSource(source, filePath)
  if ('error' in parsed) {
    return {
      routePath: filePathToRoutePath(filePath),
      fileType: fileType.kind,
      result: {
        value: null,
        warnings: [
          {
            file: filePath,
            line: 0,
            column: 0,
            field: '',
            message: `Failed to parse file: ${parsed.error}`,
            hint: 'Check for syntax errors in this file.',
          },
        ],
        hasSearch: false,
        searchSource: null,
      },
    }
  }

  return {
    routePath: filePathToRoutePath(filePath),
    fileType: fileType.kind,
    result: extractRouteCall(parsed.ast, source, filePath),
  }
}
