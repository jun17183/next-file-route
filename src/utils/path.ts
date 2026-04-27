export function filePathToRoutePath(
  filePath: string,
  appDir: string = 'app',
): string {
  let rel = filePath.replace(/\\/g, '/')

  const appPrefix = appDir.replace(/\\/g, '/').replace(/\/$/, '')
  const idx = rel.indexOf(appPrefix)
  if (idx !== -1) {
    rel = rel.slice(idx + appPrefix.length)
  }

  rel = rel.replace(/\/(page|layout)\.(ts|tsx|js|jsx)$/, '')
  rel = rel.replace(/\/\([^)]+\)/g, '')
  rel = rel.replace(/\/+/g, '/')
  rel = rel.replace(/\/$/, '')

  return rel || '/'
}

export function isRouteFile(filePath: string): {
  kind: 'page' | 'layout'
} | null {
  const normalized = filePath.replace(/\\/g, '/')
  const m = normalized.match(/\/(page|layout)\.(ts|tsx|js|jsx)$/)
  if (m) return { kind: m[1] as 'page' | 'layout' }
  return null
}

export function matchRoute(
  pathname: string,
  routePaths: string[],
): string | null {
  if (routePaths.includes(pathname)) return pathname

  type Candidate = { pattern: string; specificity: number; tier: number }
  const candidates: Candidate[] = []

  const pathSegments = pathname.split('/').filter(Boolean)

  for (const pattern of routePaths) {
    const patternSegments = pattern.split('/').filter(Boolean)

    const optCatchAllIdx = patternSegments.findIndex(
      (s) => s.startsWith('[[...') && s.endsWith(']]'),
    )
    if (optCatchAllIdx !== -1) {
      const staticPart = patternSegments.slice(0, optCatchAllIdx)
      const matches =
        staticPart.length <= pathSegments.length &&
        staticPart.every((s, i) => isDynamicSegment(s) || s === pathSegments[i])
      if (matches) {
        candidates.push({ pattern, specificity: optCatchAllIdx, tier: 0 })
      }
      continue
    }

    const catchAllIdx = patternSegments.findIndex((s) => s.startsWith('[...'))
    if (catchAllIdx !== -1) {
      const staticPart = patternSegments.slice(0, catchAllIdx)
      const matches =
        pathSegments.length >= catchAllIdx + 1 &&
        staticPart.every((s, i) => isDynamicSegment(s) || s === pathSegments[i])
      if (matches) {
        candidates.push({ pattern, specificity: catchAllIdx, tier: 1 })
      }
      continue
    }

    if (patternSegments.length !== pathSegments.length) continue

    let match = true
    let specificity = 0
    for (let i = 0; i < patternSegments.length; i++) {
      const seg = patternSegments[i]
      if (isDynamicSegment(seg)) {
        // dynamic segments contribute 0 specificity
      } else if (seg === pathSegments[i]) {
        specificity++
      } else {
        match = false
        break
      }
    }

    if (match) {
      candidates.push({ pattern, specificity, tier: 2 })
    }
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (a.tier !== b.tier) return b.tier - a.tier
    return b.specificity - a.specificity
  })
  return candidates[0].pattern
}

function isDynamicSegment(seg: string): boolean {
  return seg.startsWith('[') && seg.endsWith(']')
}
