import { describe, expect, it } from 'vitest'

import {
  calibrateControlMappingMaximumRaw,
  controlMappingRawValueAtPercent,
} from './control-mapping-calibration'

describe('Control Mapping calibration', () => {
  it('derives a linear maximum from a target at a controller position', () => {
    const maximum = calibrateControlMappingMaximumRaw(10_000, 50, 30_000)

    expect(maximum).toBe(50_000)
    expect(controlMappingRawValueAtPercent(10_000, maximum, 50)).toBe(30_000)
  })

  it('clamps an unreachable calibration and exposes the saturated preview', () => {
    const maximum = calibrateControlMappingMaximumRaw(12_000, 80, 62_198)

    expect(maximum).toBe(65_535)
    expect(controlMappingRawValueAtPercent(12_000, maximum, 80)).toBe(54_828)
  })
})
