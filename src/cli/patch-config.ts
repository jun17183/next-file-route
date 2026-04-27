export function patchNextConfig(content: string, isESM: boolean): string | null {
  const importLine = isESM
    ? "import { withFileRoute } from 'next-file-route/plugin'"
    : "const { withFileRoute } = require('next-file-route/plugin')"

  const exportPattern = isESM
    ? /export\s+default\s+([A-Za-z_$][\w$]*)\s*;?\s*$/m
    : /module\.exports\s*=\s*([A-Za-z_$][\w$]*)\s*;?\s*$/m

  const identMatch = content.match(exportPattern)
  if (identMatch) {
    const ident = identMatch[1]
    const replacement = isESM
      ? `export default withFileRoute(${ident})`
      : `module.exports = withFileRoute(${ident})`
    return `${importLine}\n\n${content.replace(exportPattern, replacement)}`
  }

  const inlinePattern = isESM
    ? /export\s+default\s+/
    : /module\.exports\s*=\s*/
  if (!inlinePattern.test(content)) return null

  const extractedName = '__nextFileRouteConfig'
  const replaced = content.replace(inlinePattern, `const ${extractedName} = `)
  const trailer = isESM
    ? `\n\nexport default withFileRoute(${extractedName})\n`
    : `\n\nmodule.exports = withFileRoute(${extractedName})\n`
  return `${importLine}\n\n${replaced}${trailer}`
}
