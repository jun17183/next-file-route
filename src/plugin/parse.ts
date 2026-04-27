import { parseSync } from '@swc/core'
import type { Module } from '@swc/core'

export type ParseResult = { ast: Module } | { error: string }

export function parseSource(source: string, filePath: string): ParseResult {
  try {
    const ast = parseSync(source, {
      syntax: filePath.endsWith('.tsx') || filePath.endsWith('.ts')
        ? 'typescript'
        : 'ecmascript',
      tsx: filePath.endsWith('.tsx') || filePath.endsWith('.jsx'),
      comments: false,
    })
    return { ast }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'unknown parse error' }
  }
}
