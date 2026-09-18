import { describe, it, expect } from 'vitest'
import { SHARED_VERSION } from './index'

describe('@miro/shared', () => {
  it('is wired up', () => {
    expect(SHARED_VERSION).toBe('0.0.0')
  })
})
