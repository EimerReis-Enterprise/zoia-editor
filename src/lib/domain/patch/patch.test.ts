import { describe, expect, it } from 'vitest'

import { importPatch } from './patch'

describe('importPatch', () => {
  it('exposes stable mutation identity', () => {
    expect(importPatch.key()).toEqual(['patch', 'import'])
  })
})
