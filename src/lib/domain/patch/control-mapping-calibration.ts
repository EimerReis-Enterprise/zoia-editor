import type { PatchDocument } from './patch-document'

const RAW_PARAMETER_MAXIMUM = 65_535
const SOURCE_CALIBRATIONS_EXTENSION =
  'zoia-editor.controlSourceCalibrations.v1'

type SourceCalibration = {
  readonly fullScaleControllerValue: number
}

const sourceCalibrationKey = (moduleId: string, endpointId: string) =>
  `${moduleId}::${endpointId}`

function clampRawValue(value: number) {
  return Math.min(RAW_PARAMETER_MAXIMUM, Math.max(0, Math.round(value)))
}

/**
 * Derives the maximum raw value for a linear Control Mapping from a desired
 * target value at a controller position. The result is clamped to ZOIA's
 * unsigned 16-bit parameter range; callers can use the preview helper to
 * make a resulting saturation visible.
 */
export function calibrateControlMappingMaximumRaw(
  minimumRaw: number,
  sourcePositionPercent: number,
  targetRaw: number,
) {
  const minimum = clampRawValue(minimumRaw)
  const position = Math.min(100, Math.max(1, sourcePositionPercent)) / 100
  const target = Math.max(minimum, clampRawValue(targetRaw))
  return clampRawValue(minimum + (target - minimum) / position)
}

export function controlMappingRawValueAtPercent(
  minimumRaw: number,
  maximumRaw: number,
  sourcePositionPercent: number,
) {
  const minimum = clampRawValue(minimumRaw)
  const maximum = Math.max(minimum, clampRawValue(maximumRaw))
  const position = Math.min(100, Math.max(0, sourcePositionPercent)) / 100
  return clampRawValue(minimum + (maximum - minimum) * position)
}

export function sourceCalibrationFullScaleValue(
  document: PatchDocument | null,
  moduleId: string,
  endpointId: string,
) {
  const calibrations = document?.extensions[SOURCE_CALIBRATIONS_EXTENSION]
  if (!calibrations || typeof calibrations !== 'object') return 127
  const calibration = (calibrations as Record<string, unknown>)[
    sourceCalibrationKey(moduleId, endpointId)
  ]
  if (!calibration || typeof calibration !== 'object') return 127
  const value = (calibration as SourceCalibration).fullScaleControllerValue
  return typeof value === 'number' && value >= 1 && value <= 127 ? value : 127
}

export function setSourceCalibrationFullScaleValue(
  document: PatchDocument,
  moduleId: string,
  endpointId: string,
  fullScaleControllerValue: number,
): PatchDocument {
  const calibrations =
    (document.extensions[SOURCE_CALIBRATIONS_EXTENSION] as Record<string, unknown> | undefined) ?? {}
  return {
    ...document,
    extensions: {
      ...document.extensions,
      [SOURCE_CALIBRATIONS_EXTENSION]: {
        ...calibrations,
        [sourceCalibrationKey(moduleId, endpointId)]: {
          fullScaleControllerValue: Math.min(127, Math.max(1, Math.round(fullScaleControllerValue))),
        },
      },
    },
  }
}
