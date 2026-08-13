import { describe, expect, it } from 'vitest'

import {
  calibrateControlMappingStrengthRaw,
  connectionStrengthRawForTargetRange,
  controlMappingMaximumRaw,
  controlMappingSaturationSourcePercent,
  controlMappingTargetRawAtSourcePercent,
} from './control-mapping'

describe('Control Mapping hardware scale', () => {
  it('treats connection strength as hundredths of one percent', () => {
    expect(controlMappingMaximumRaw(0, 10_000)).toBe(65_535)
    expect(controlMappingTargetRawAtSourcePercent(0, 10_000, 50)).toBe(32_768)
  })

  it('converts a target parameter span to hardware connection strength', () => {
    expect(connectionStrengthRawForTargetRange(0, 32_768)).toBe(5_000)
    expect(connectionStrengthRawForTargetRange(10_000, 30_000)).toBe(3_052)
  })

  it('clamps target values when modulation exceeds the parameter range', () => {
    expect(controlMappingMaximumRaw(1_096, 18_822)).toBe(65_535)
    expect(controlMappingSaturationSourcePercent(1_096, 18_822)).toBeCloseTo(
      52.24,
      2,
    )
  })

  it('calibrates hardware strength at an intermediate source position', () => {
    const strength = calibrateControlMappingStrengthRaw(12_000, 80, 62_198)

    expect(strength).toBe(9_575)
    expect(controlMappingTargetRawAtSourcePercent(12_000, strength, 80)).toBe(
      62_200,
    )
    expect(controlMappingMaximumRaw(12_000, strength)).toBe(65_535)
  })
})
