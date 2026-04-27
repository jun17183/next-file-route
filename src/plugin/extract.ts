import type {
  Module,
  ModuleItem,
  Expression,
  VariableDeclaration,
  ObjectExpression,
  KeyValueProperty,
  SpreadElement,
  ArrayExpression,
  ExprOrSpread,
} from '@swc/core'
import { collectZodIdentifiers, isZodCallExpression } from './extract-zod'
import { collectRouteIdentifiers, findRouteCallArgument } from './extract-call'

export interface ExtractionWarning {
  file: string
  line: number
  column: number
  field: string
  message: string
  hint?: string
}

export const ZOD_SCHEMA_MARKER = '__ZOD_SCHEMA__'

export interface ExtractionResult {
  value: Record<string, unknown> | null
  warnings: ExtractionWarning[]
  hasSearch: boolean
  searchSource: string | null
}

interface ExtractorContext {
  filePath: string
  consts: Map<string, Expression>
  zodIdentifiers: Set<string>
  warnings: ExtractionWarning[]
  locate(offset: number): { line: number; column: number }
}

export function extractRouteCall(
  ast: Module,
  source: string,
  filePath: string,
): ExtractionResult {
  const warnings: ExtractionWarning[] = []

  const ctx: ExtractorContext = {
    filePath,
    consts: new Map(),
    zodIdentifiers: collectZodIdentifiers(ast),
    warnings,
    locate: makeLocator(source, ast.span?.start ?? 0),
  }

  for (const item of ast.body) {
    collectTopLevelConsts(item, ctx.consts)
  }

  const routeIdentifiers = collectRouteIdentifiers(ast)
  const callArg = findRouteCallArgument(ast, routeIdentifiers)
  if (!callArg) {
    return { value: null, warnings, hasSearch: false, searchSource: null }
  }

  const value = evaluateExpression(callArg, '', ctx)
  if (value !== undefined && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    const hasSearch = obj.search === ZOD_SCHEMA_MARKER
    const searchSource = hasSearch
      ? sliceSearchSource(callArg, source, ast.span?.start ?? 0)
      : null
    return { value: obj, warnings, hasSearch, searchSource }
  }

  const loc = ctx.locate((callArg as { span?: { start: number } }).span?.start ?? 0)
  warnings.push({
    file: filePath,
    line: loc.line,
    column: loc.column,
    field: 'route()',
    message: 'route() argument must be an object literal expression.',
    hint: 'Use `route({ meta: { title: "..." } })`',
  })
  return { value: null, warnings, hasSearch: false, searchSource: null }
}

function sliceSearchSource(
  arg: Expression,
  source: string,
  baseOffset: number,
): string | null {
  if (arg.type !== 'ObjectExpression') return null
  for (const prop of arg.properties) {
    if (prop.type !== 'KeyValueProperty') continue
    const key = extractPropertyKey(prop)
    if (key !== 'search') continue
    const span = (prop.value as { span?: { start: number; end: number } }).span
    if (!span) return null
    const start = Math.max(0, span.start - baseOffset)
    const end = Math.max(start, Math.min(source.length, span.end - baseOffset))
    return source.slice(start, end)
  }
  return null
}

function makeLocator(source: string, baseOffset: number) {
  return (offset: number): { line: number; column: number } => {
    if (offset <= 0) return { line: 0, column: 0 }
    const idx = Math.max(0, Math.min(source.length, offset - baseOffset))
    let line = 1
    let column = 1
    for (let i = 0; i < idx; i++) {
      if (source.charCodeAt(i) === 10) {
        line++
        column = 1
      } else {
        column++
      }
    }
    return { line, column }
  }
}

function collectTopLevelConsts(
  item: ModuleItem,
  consts: Map<string, Expression>,
): void {
  if (item.type === 'VariableDeclaration' && item.kind === 'const') {
    extractConstsFromDecl(item, consts)
    return
  }
  if (
    item.type === 'ExportDeclaration' &&
    item.declaration.type === 'VariableDeclaration' &&
    item.declaration.kind === 'const'
  ) {
    extractConstsFromDecl(item.declaration, consts)
  }
}

function extractConstsFromDecl(
  decl: VariableDeclaration,
  consts: Map<string, Expression>,
): void {
  for (const d of decl.declarations) {
    if (d.id.type === 'Identifier' && d.init) {
      consts.set(d.id.value, d.init)
    }
  }
}

function evaluateExpression(
  expr: Expression,
  fieldPath: string,
  ctx: ExtractorContext,
): unknown {
  switch (expr.type) {
    case 'StringLiteral':
      return expr.value

    case 'NumericLiteral':
      return expr.value

    case 'BooleanLiteral':
      return expr.value

    case 'NullLiteral':
      return null

    case 'TemplateLiteral': {
      if (expr.expressions.length > 0) {
        warn(expr, fieldPath, 'template literal with expressions', ctx)
        return undefined
      }
      return expr.quasis.map((q) => q.raw).join('')
    }

    case 'ArrayExpression':
      return evaluateArray(expr, fieldPath, ctx)

    case 'ObjectExpression':
      return evaluateObject(expr, fieldPath, ctx)

    case 'Identifier': {
      const ref = ctx.consts.get(expr.value)
      if (ref) {
        return evaluateExpression(ref, fieldPath, ctx)
      }
      if (expr.value === 'undefined') return undefined
      warn(expr, fieldPath, `identifier '${expr.value}' (unresolvable)`, ctx)
      return undefined
    }

    case 'UnaryExpression': {
      if (expr.operator === '-') {
        const arg = evaluateExpression(expr.argument, fieldPath, ctx)
        if (typeof arg === 'number') return -arg
      }
      warn(expr, fieldPath, `unary expression '${expr.operator}'`, ctx)
      return undefined
    }

    case 'TsAsExpression':
    case 'TsSatisfiesExpression':
    case 'TsNonNullExpression':
    case 'TsTypeAssertion':
    case 'TsConstAssertion':
      return evaluateExpression((expr as any).expression, fieldPath, ctx)

    case 'ParenthesisExpression':
      return evaluateExpression(expr.expression, fieldPath, ctx)

    case 'CallExpression': {
      if (isZodCallExpression(expr, ctx.zodIdentifiers)) {
        return ZOD_SCHEMA_MARKER
      }
      warn(expr, fieldPath, `function call (not whitelisted)`, ctx)
      return undefined
    }

    default:
      warn(expr as any, fieldPath, `${expr.type} (not statically extractable)`, ctx)
      return undefined
  }
}

function evaluateObject(
  expr: ObjectExpression,
  fieldPath: string,
  ctx: ExtractorContext,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const prop of expr.properties) {
    if (prop.type === 'SpreadElement') {
      const spreadValue = evaluateExpression(
        (prop as SpreadElement).arguments,
        fieldPath,
        ctx,
      )
      if (spreadValue && typeof spreadValue === 'object' && !Array.isArray(spreadValue)) {
        Object.assign(result, spreadValue)
      } else {
        warn(prop as any, fieldPath, 'spread element (not resolvable)', ctx)
      }
      continue
    }

    if (prop.type === 'KeyValueProperty') {
      const kv = prop as KeyValueProperty
      const key = extractPropertyKey(kv)
      if (key === null) {
        warn(kv as any, fieldPath, 'computed property key', ctx)
        continue
      }
      const childPath = fieldPath ? `${fieldPath}.${key}` : key
      const value = evaluateExpression(kv.value, childPath, ctx)
      if (value !== undefined) {
        result[key] = value
      }
      continue
    }

    if (prop.type === 'Identifier') {
      const key = (prop as any).value
      const childPath = fieldPath ? `${fieldPath}.${key}` : key
      const ref = ctx.consts.get(key)
      if (ref) {
        const value = evaluateExpression(ref, childPath, ctx)
        if (value !== undefined) {
          result[key] = value
        }
      } else {
        warn(prop as any, childPath, `shorthand '${key}' (unresolvable)`, ctx)
      }
      continue
    }

    warn(prop as any, fieldPath, `${prop.type} (not supported)`, ctx)
  }

  return result
}

function evaluateArray(
  expr: ArrayExpression,
  fieldPath: string,
  ctx: ExtractorContext,
): unknown[] {
  const result: unknown[] = []

  for (let i = 0; i < expr.elements.length; i++) {
    const el = expr.elements[i]
    if (!el) {
      result.push(null)
      continue
    }
    if (el.spread) {
      warn(el.expression as any, `${fieldPath}[${i}]`, 'spread in array', ctx)
      continue
    }
    const value = evaluateExpression(
      (el as ExprOrSpread).expression,
      `${fieldPath}[${i}]`,
      ctx,
    )
    result.push(value ?? null)
  }

  return result
}

function extractPropertyKey(kv: KeyValueProperty): string | null {
  if (kv.key.type === 'Identifier') return kv.key.value
  if (kv.key.type === 'StringLiteral') return kv.key.value
  if (kv.key.type === 'NumericLiteral') return String(kv.key.value)
  return null
}

function warn(
  node: { span?: { start: number; end: number } },
  fieldPath: string,
  found: string,
  ctx: ExtractorContext,
): void {
  const loc = ctx.locate(node.span?.start ?? 0)
  ctx.warnings.push({
    file: ctx.filePath,
    line: loc.line,
    column: loc.column,
    field: fieldPath || 'routeConfig',
    message: `${fieldPath || 'routeConfig'} must be statically extractable. Found: ${found}.`,
    hint: 'Inline the value, or use a const literal in the same file.',
  })
}
