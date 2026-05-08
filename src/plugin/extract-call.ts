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

export interface RouteCallInfo {
  arg: Expression
  exportedName: string | null
}

export function findRouteCallInfo(
  ast: Module,
  routeIdentifiers: Set<string>,
): RouteCallInfo | null {
  for (const item of ast.body) {
    const found = findInTopLevelItem(item, routeIdentifiers)
    if (found) return found
  }
  return null
}

interface SearchHit {
  arg: Expression
  direct: boolean
}

function findInTopLevelItem(
  item: ModuleItem,
  routeIdentifiers: Set<string>,
): RouteCallInfo | null {
  if (item.type === 'VariableDeclaration' && item.kind === 'const') {
    for (const d of item.declarations) {
      if (d.init) {
        const hit = findInExpression(d.init, routeIdentifiers)
        if (hit) return { arg: hit.arg, exportedName: null }
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
        const hit = findInExpression(d.init, routeIdentifiers)
        if (hit) {
          const name =
            hit.direct && d.id.type === 'Identifier' ? d.id.value : null
          return { arg: hit.arg, exportedName: name }
        }
      }
    }
    return null
  }
  if (item.type === 'ExpressionStatement') {
    const hit = findInExpression(item.expression, routeIdentifiers)
    if (hit) return { arg: hit.arg, exportedName: null }
  }
  return null
}

function findInExpression(
  expr: Expression,
  routeIdentifiers: Set<string>,
): SearchHit | null {
  if (expr.type === 'CallExpression') {
    const callee = expr.callee
    if (callee.type === 'Identifier' && routeIdentifiers.has(callee.value)) {
      const first = expr.arguments[0]
      if (!first || first.spread) return null
      return { arg: first.expression as Expression, direct: true }
    }
  }
  if (expr.type === 'MemberExpression') {
    const inner = findInExpression(expr.object as Expression, routeIdentifiers)
    if (inner) return { arg: inner.arg, direct: false }
  }
  if (expr.type === 'ParenthesisExpression') {
    return findInExpression(expr.expression, routeIdentifiers)
  }
  if (
    expr.type === 'TsAsExpression' ||
    expr.type === 'TsSatisfiesExpression' ||
    expr.type === 'TsConstAssertion' ||
    expr.type === 'TsNonNullExpression' ||
    expr.type === 'TsTypeAssertion'
  ) {
    return findInExpression(
      (expr as { expression: Expression }).expression,
      routeIdentifiers,
    )
  }
  return null
}
