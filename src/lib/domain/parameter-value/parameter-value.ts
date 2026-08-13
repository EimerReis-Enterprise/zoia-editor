const RAW_PARAMETER_MAXIMUM = 65_535

export type ParameterValueDefinition = {
  readonly unit?: string | null
  readonly range?: readonly (number | null)[]
  readonly defaultRawValue?: number
}

const normalizedRawValue = (rawValue: number) =>
  Math.min(RAW_PARAMETER_MAXIMUM, Math.max(0, rawValue)) /
  RAW_PARAMETER_MAXIMUM

function interpolateCurve(
  value: number,
  anchors: readonly number[],
  values: readonly number[],
) {
  if (value <= anchors[0]) return values[0]
  if (value >= anchors.at(-1)!) return values.at(-1)!
  for (let index = 1; index < anchors.length; index += 1) {
    if (value > anchors[index]) continue
    const startAnchor = anchors[index - 1]
    const endAnchor = anchors[index]
    const startValue = values[index - 1]
    const endValue = values[index]
    if (endAnchor === startAnchor) return endValue
    const position = ((value - startAnchor) / (endAnchor - startAnchor)) ** 1.6
    return startValue + (endValue - startValue) * position
  }
  return values.at(-1)!
}

function finiteDisplayRange(
  range: readonly (number | null)[],
  unit: string | null | undefined,
) {
  return range.map((value, index) => {
    if (value !== null) return value
    if (index === 0) return -120
    if (index === range.length - 1 && unit === 's') return 487.68
    return 120
  })
}

export function formatParameterValue(
  rawValue: number,
  definition: ParameterValueDefinition,
) {
  const normalized = normalizedRawValue(rawValue)
  const range = definition.range
  const unit = definition.unit
  if (!range || range.length === 0) {
    return `${(normalized * 100).toFixed(1)}% raw range`
  }
  if (rawValue <= 0 && range[0] === null) return `−∞${unit ? ` ${unit}` : ''}`
  if (rawValue >= RAW_PARAMETER_MAXIMUM && range.at(-1) === null)
    return `∞${unit ? ` ${unit}` : ''}`

  const values = finiteDisplayRange(range, unit)
  let decoded = normalized
  if (values.length === 2) {
    decoded = values[0] + (values[1] - values[0]) * normalized
  } else if (values.length === 5) {
    const anchors = [0, 0.25, 0.5, 0.75, 1]
    const curveValues = [...values]
    if (
      unit === 'dB' &&
      !curveValues.includes(0) &&
      definition.defaultRawValue !== undefined &&
      definition.defaultRawValue > 0 &&
      definition.defaultRawValue < RAW_PARAMETER_MAXIMUM
    ) {
      const defaultPosition = normalizedRawValue(definition.defaultRawValue)
      const insertionIndex = anchors.findIndex(
        (anchor) => anchor > defaultPosition,
      )
      anchors.splice(insertionIndex, 0, defaultPosition)
      curveValues.splice(insertionIndex, 0, 0)
    }
    decoded = interpolateCurve(normalized, anchors, curveValues)
  }
  return `${decoded.toFixed(1)}${unit ? ` ${unit}` : ''}`
}
