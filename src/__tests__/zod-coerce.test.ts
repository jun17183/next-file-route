import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { coerceSearchParams, getZodTypeName } from '../utils/zod-coerce'

describe('getZodTypeName (Zod 3 + Zod 4)', () => {
  it('returns the inner primitive name for plain schemas', () => {
    expect(getZodTypeName(z.number())).toBe('number')
    expect(getZodTypeName(z.string())).toBe('string')
    expect(getZodTypeName(z.boolean())).toBe('boolean')
  })

  it('unwraps optional / default / nullable wrappers', () => {
    expect(getZodTypeName(z.number().optional())).toBe('number')
    expect(getZodTypeName(z.number().default(1))).toBe('number')
    expect(getZodTypeName(z.string().nullable())).toBe('string')
  })

  it('unwraps deeply nested wrappers', () => {
    expect(
      getZodTypeName(z.number().optional().default(1)),
    ).toBe('number')
    expect(
      getZodTypeName(z.boolean().nullable().optional()),
    ).toBe('boolean')
  })

  it('returns null for non-schema values', () => {
    expect(getZodTypeName(null)).toBeNull()
    expect(getZodTypeName(undefined)).toBeNull()
    expect(getZodTypeName({})).toBeNull()
    expect(getZodTypeName('not a schema')).toBeNull()
  })

  it('simulates a Zod 3-style schema and still produces the lowercase name', () => {
    const fakeZ3Schema = {
      parse: () => undefined,
      _def: {
        typeName: 'ZodOptional',
        innerType: { _def: { typeName: 'ZodNumber' } },
      },
    }
    expect(getZodTypeName(fakeZ3Schema)).toBe('number')
  })
})

describe('coerceSearchParams', () => {
  it('coerces numeric string fields to number', () => {
    const schema = z.object({
      page: z.number(),
      sort: z.string(),
    })
    const result = coerceSearchParams({ page: '42', sort: 'asc' }, schema)
    expect(result).toEqual({ page: 42, sort: 'asc' })
  })

  it('coerces optional/defaulted number fields', () => {
    const schema = z.object({
      page: z.number().optional().default(1),
    })
    const result = coerceSearchParams({ page: '7' }, schema)
    expect(result).toEqual({ page: 7 })
  })

  it('coerces booleans from string truthy markers', () => {
    const schema = z.object({ active: z.boolean() })
    expect(coerceSearchParams({ active: 'true' }, schema)).toEqual({ active: true })
    expect(coerceSearchParams({ active: '1' }, schema)).toEqual({ active: true })
    expect(coerceSearchParams({ active: 'false' }, schema)).toEqual({ active: false })
    expect(coerceSearchParams({ active: '0' }, schema)).toEqual({ active: false })
  })

  it('keeps the original string when number coercion would yield NaN', () => {
    const schema = z.object({ page: z.number() })
    const result = coerceSearchParams({ page: 'not-a-number' }, schema)
    expect(result).toEqual({ page: 'not-a-number' })
  })

  it('passes through unknown / unschema-d fields unchanged', () => {
    const schema = z.object({ page: z.number() })
    const result = coerceSearchParams({ page: '1', extra: 'x' }, schema)
    expect(result).toEqual({ page: 1, extra: 'x' })
  })

  it('passes through array values without coercion', () => {
    const schema = z.object({ tags: z.array(z.string()) })
    const result = coerceSearchParams({ tags: ['a', 'b'] }, schema)
    expect(result).toEqual({ tags: ['a', 'b'] })
  })

  it('returns the raw object when given a non-Zod value', () => {
    const result = coerceSearchParams({ x: '1' }, null)
    expect(result).toEqual({ x: '1' })
  })

  it('end-to-end: coerced values round-trip through schema.parse', () => {
    const schema = z.object({
      page: z.number().default(1),
      sort: z.enum(['asc', 'desc']).default('asc'),
      q: z.string().optional(),
    })
    const coerced = coerceSearchParams({ page: '3', sort: 'desc' }, schema)
    expect(() => schema.parse(coerced)).not.toThrow()
    expect(schema.parse(coerced)).toEqual({ page: 3, sort: 'desc' })
  })
})
