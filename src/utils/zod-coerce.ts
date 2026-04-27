const WRAPPER_TYPES = new Set([
  'ZodOptional',
  'ZodDefault',
  'ZodNullable',
  'optional',
  'default',
  'nullable',
])

export function coerceSearchParams(
  raw: Record<string, string | string[]>,
  schema: unknown,
): Record<string, unknown> {
  if (!isZodSchema(schema)) return raw

  const shape = (schema as { shape?: Record<string, unknown> }).shape
  if (!shape || typeof shape !== 'object') return raw

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(raw)) {
    const fieldSchema = shape[key]
    if (!fieldSchema) {
      result[key] = value
      continue
    }

    const typeName = getZodTypeName(fieldSchema)

    if (typeof value === 'string') {
      if (typeName === 'number') {
        const n = Number(value)
        result[key] = Number.isNaN(n) ? value : n
      } else if (typeName === 'boolean') {
        result[key] = value === 'true' || value === '1'
      } else {
        result[key] = value
      }
    } else {
      result[key] = value
    }
  }

  return result
}

export function getZodTypeName(schema: unknown): string | null {
  if (!schema || typeof schema !== 'object') return null
  const def = (schema as { _def?: { typeName?: string; type?: string; innerType?: unknown } })._def
  if (!def) return null

  const raw = def.typeName ?? def.type
  if (!raw) return null

  if (WRAPPER_TYPES.has(raw) && def.innerType) {
    return getZodTypeName(def.innerType)
  }

  return normalizeTypeName(raw)
}

function normalizeTypeName(raw: string): string {
  if (raw.startsWith('Zod')) {
    return raw.slice(3).toLowerCase()
  }
  return raw.toLowerCase()
}

function isZodSchema(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    'parse' in (value as object) &&
    typeof (value as { parse?: unknown }).parse === 'function'
  )
}
