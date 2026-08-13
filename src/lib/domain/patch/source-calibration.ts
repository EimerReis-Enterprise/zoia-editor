import type { PatchDocument } from './patch-document'

const SOURCE_CALIBRATIONS_EXTENSION =
  'zoia-editor.controlSourceCalibrations.v1'

type SourceCalibration = {
  readonly fullScaleControllerValue: number
}

const sourceCalibrationKey = (moduleId: string, endpointId: string) =>
  `${moduleId}::${endpointId}`

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
