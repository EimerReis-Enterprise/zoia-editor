import { describe, expect, it } from 'vitest'

import { formatParameterValue } from './parameter-value'

describe('ZOIA Parameter Value formatting', () => {
  it('uses the nonlinear five-anchor curve from zoia_lib', () => {
    expect(
      formatParameterValue(1_096, {
        unit: 'Hz',
        range: [27.5, 155.56, 880, 4_978, 23_999],
        defaultRawValue: 0,
      }),
    ).toBe('29.2 Hz')
  })

  it('inserts the documented zero dB anchor at the default value', () => {
    expect(
      formatParameterValue(54_394, {
        unit: 'dB',
        range: [-100, -70, -40, -10, 20],
        defaultRawValue: 54_394,
      }),
    ).toBe('0.0 dB')
  })

  it('preserves infinite endpoints honestly', () => {
    expect(
      formatParameterValue(0, {
        unit: 'dB',
        range: [null, -12, -6, -2.5, 0],
        defaultRawValue: 0,
      }),
    ).toBe('−∞ dB')
    expect(
      formatParameterValue(65_535, {
        unit: 's',
        range: [0, 2.62, 4.12, 8.6, null],
        defaultRawValue: 32_768,
      }),
    ).toBe('∞ s')
  })

  it('falls back to the raw range when metadata is unavailable', () => {
    expect(formatParameterValue(32_768, {})).toBe('50.0% raw range')
  })
})
