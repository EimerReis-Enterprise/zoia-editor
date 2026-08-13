const RAW_PARAMETER_MAXIMUM = 65_535
const CONNECTION_STRENGTH_UNITY = 10_000

const clampRawParameter = (value: number) =>
  Math.min(RAW_PARAMETER_MAXIMUM, Math.max(0, Math.round(value)))

const clampConnectionStrength = (value: number) =>
  Math.min(RAW_PARAMETER_MAXIMUM, Math.max(0, Math.round(value)))

/** Converts ZOIA connection strength (10000 = 100%) into a target raw span. */
export function targetRawSpanForConnectionStrength(strengthRaw: number) {
  return Math.round(
    (clampConnectionStrength(strengthRaw) / CONNECTION_STRENGTH_UNITY) *
      RAW_PARAMETER_MAXIMUM,
  )
}

/** Converts a desired target parameter range into ZOIA connection strength. */
export function connectionStrengthRawForTargetRange(
  minimumRaw: number,
  maximumRaw: number,
) {
  const minimum = clampRawParameter(minimumRaw)
  const maximum = Math.max(minimum, clampRawParameter(maximumRaw))
  return clampConnectionStrength(
    ((maximum - minimum) / RAW_PARAMETER_MAXIMUM) *
      CONNECTION_STRENGTH_UNITY,
  )
}

export function controlMappingTargetRawAtSourcePercent(
  minimumRaw: number,
  strengthRaw: number,
  sourcePositionPercent: number,
) {
  const minimum = clampRawParameter(minimumRaw)
  const position = Math.min(100, Math.max(0, sourcePositionPercent)) / 100
  return clampRawParameter(
    minimum + targetRawSpanForConnectionStrength(strengthRaw) * position,
  )
}

export function controlMappingMaximumRaw(
  minimumRaw: number,
  strengthRaw: number,
) {
  return controlMappingTargetRawAtSourcePercent(minimumRaw, strengthRaw, 100)
}

export function controlMappingSaturationSourcePercent(
  minimumRaw: number,
  strengthRaw: number,
) {
  const availableSpan = RAW_PARAMETER_MAXIMUM - clampRawParameter(minimumRaw)
  const drivenSpan = targetRawSpanForConnectionStrength(strengthRaw)
  if (drivenSpan <= 0 || drivenSpan <= availableSpan) return 100
  return (availableSpan / drivenSpan) * 100
}

/**
 * Finds hardware connection strength for a desired target value at a source
 * position. Strength may exceed 100%, in which case the target saturates before
 * the source reaches full scale.
 */
export function calibrateControlMappingStrengthRaw(
  minimumRaw: number,
  sourcePositionPercent: number,
  targetRaw: number,
) {
  const minimum = clampRawParameter(minimumRaw)
  const target = Math.max(minimum, clampRawParameter(targetRaw))
  const position = Math.min(100, Math.max(1, sourcePositionPercent)) / 100
  return clampConnectionStrength(
    ((target - minimum) / RAW_PARAMETER_MAXIMUM / position) *
      CONNECTION_STRENGTH_UNITY,
  )
}
