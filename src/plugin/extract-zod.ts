import type { Module, Expression } from '@swc/core'

export function collectZodIdentifiers(ast: Module): Set<string> {
  const idents = new Set<string>(['z'])

  for (const item of ast.body) {
    if (item.type !== 'ImportDeclaration') continue
    if (item.source.value !== 'zod') continue

    for (const spec of item.specifiers) {
      const local = (spec as { local?: { value?: string } }).local?.value
      if (local) idents.add(local)
    }
  }

  return idents
}

export function isZodCallExpression(
  expr: Expression,
  zodIdentifiers: Set<string>,
): boolean {
  if (expr.type !== 'CallExpression') return false
  return isZodCallee(expr.callee, zodIdentifiers)
}

function isZodCallee(expr: any, zodIdentifiers: Set<string>): boolean {
  if (!expr) return false

  if (expr.type === 'Identifier') {
    return zodIdentifiers.has(expr.value)
  }

  if (expr.type === 'MemberExpression') {
    if (expr.object.type === 'Identifier') {
      return zodIdentifiers.has(expr.object.value)
    }
    if (expr.object.type === 'CallExpression') {
      return isZodCallExpression(expr.object, zodIdentifiers)
    }
    return isZodCallee(expr.object, zodIdentifiers)
  }

  return false
}
