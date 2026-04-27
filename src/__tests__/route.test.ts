import { describe, it, expect } from 'vitest'
import { route } from '../runtime/route'

describe('route()', () => {
  it('returns the original config under .config', () => {
    const config = { meta: { title: 'X', roles: ['admin'] } }
    const r = route(config)
    expect(r.config).toBe(config)
  })

  it('exposes meta as sugar', () => {
    const r = route({ meta: { title: 'X' } })
    expect(r.meta).toEqual({ title: 'X' })
  })

  it('returns a static metadata object that mirrors meta', async () => {
    const r = route({ meta: { title: 'X', description: 'Y' } })
    expect(r.metadata).toEqual({ title: 'X', description: 'Y' })
  })

  it('produces an async generateMetadata that resolves to a copy of meta', async () => {
    const r = route({ meta: { title: 'X' } })
    await expect(r.generateMetadata()).resolves.toEqual({ title: 'X' })
  })

  it('handles a config without a meta field', async () => {
    const r = route({} as any)
    expect(r.meta).toBeUndefined()
    expect(r.metadata).toEqual({})
    await expect(r.generateMetadata()).resolves.toEqual({})
  })

  it('does not freeze the original meta — generateMetadata returns a copy', async () => {
    const original = { title: 'Original' }
    const r = route({ meta: original })
    const m = await r.generateMetadata()
    m.title = 'Mutated'
    expect(original.title).toBe('Original')
  })
})
