import type { Module, ModuleItem, Expression } from '@swc/core'

const ROUTE_SOURCES = new Set(['next-file-route', 'next-file-route/server'])

export function collectRouteIdentifiers(ast: Module): Set<string> {
  const idents = new Set<string>()

  for (const item of ast.body) {
    if (item.type !== 'ImportDeclaration') continue
    if (!ROUTE_SOURCES.has(item.source.value)) continue

    for (const spec of item.specifiers) {
      if (spec.type !== 'ImportSpecifier') continue
      const imported = (spec as { imported?: { value?: string } }).imported?.value
      const local = (spec as { local?: { value?: string } }).local?.value
      const sourceName = imported ?? local
      if (sourceName === 'route' && local) {
        idents.add(local)
      }
    }
  }

  return idents
}

export function findRouteCallArgument(
  ast: Module,
  routeIdentifiers: Set<string>,
): Expression | null {
  for (const item of ast.body) {
    const found = findInTopLevelItem(item, routeIdentifiers)
    if (found) return found
  }
  return null
}

function findInTopLevelItem(
  item: ModuleItem,
  routeIdentifiers: Set<string>,
): Expression | null {
  if (item.type === 'VariableDeclaration' && item.kind === 'const') {
    for (const d of item.declarations) {
      if (d.init) {
        const found = findInExpression(d.init, routeIdentifiers)
        if (found) return found
      }
    }
    return null
  }
  if (
    item.type === 'ExportDeclaration' &&
    item.declaration.type === 'VariableDeclaration' &&
    item.declaration.kind === 'const'
  ) {
    for (const d of item.declaration.declarations) {
      if (d.init) {
        const found = findInExpression(d.init, routeIdentifiers)
        if (found) return found
      }
    }
    return null
  }
  if (item.type === 'ExpressionStatement') {
    return findInExpression(item.expression, routeIdentifiers)
  }
  return null
}

function findInExpression(
  expr: Expression,
  routeIdentifiers: Set<string>,
): Expression | null {
  if (expr.type === 'CallExpression') {
    const callee = expr.callee
    if (callee.type === 'Identifier' && routeIdentifiers.has(callee.value)) {
      const first = expr.arguments[0]
      return first && !first.spread ? (first.expression as Expression) : null
    }
  }
  if (expr.type === 'MemberExpression') {
    return findInExpression(expr.object as Expression, routeIdentifiers)
  }
  if (expr.type === 'ParenthesisExpression') {
    return findInExpression(expr.expression, routeIdentifiers)
  }
  return null
}
