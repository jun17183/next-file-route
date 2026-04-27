import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import fg from 'fast-glob'

export interface SourceFile {
  relPath: string
  source: string
}

export function readSourceFiles(root: string, include: string[]): SourceFile[] {
  const paths = new Set<string>()
  for (const pattern of include) {
    for (const p of fg.sync(pattern, { cwd: root })) {
      paths.add(p)
    }
  }

  const files: SourceFile[] = []
  for (const relPath of paths) {
    try {
      const source = readFileSync(resolve(root, relPath), 'utf-8')
      files.push({ relPath, source })
    } catch {
      // unreadable — surfaces later as a missing manifest entry
    }
  }
  return files
}
