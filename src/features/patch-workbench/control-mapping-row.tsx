import {
  calibrateControlMappingStrengthRaw,
  controlMappingMaximumRaw,
  controlMappingSaturationSourcePercent,
  controlMappingTargetRawAtSourcePercent,
} from '#/lib/domain/control-mapping'
import { formatParameterValue } from '#/lib/domain/parameter-value'
import type {
  PatchDocumentConnection,
  PatchDocumentModule,
} from '#/lib/domain/patch'
import { useState } from 'react'

type ControlMappingRowProps = {
  mapping: PatchDocumentConnection
  targetModule: PatchDocumentModule | undefined
  target: PatchDocumentModule['endpoints'][number] | undefined
  parameter: PatchDocumentModule['parameters'][number] | undefined
  sourceFullScaleValue: number
  onSetRange: (
    connectionId: string,
    minimumRaw: number,
    maximumRaw: number,
  ) => void
  onSetStrength: (connectionId: string, strengthRaw: number) => void
  onRemove: (connectionId: string) => void
}

const clampRaw = (value: number) => Math.min(65_535, Math.max(0, value))

export function ControlMappingRow({
  mapping,
  targetModule,
  target,
  parameter,
  sourceFullScaleValue,
  onSetRange,
  onSetStrength,
  onRemove,
}: ControlMappingRowProps) {
  const initialMinimum =
    typeof parameter?.rawValue === 'number' ? parameter.rawValue : 0
  const initialMaximum = controlMappingMaximumRaw(
    initialMinimum,
    mapping.strengthRaw,
  )
  const saturationSourcePercent = controlMappingSaturationSourcePercent(
    initialMinimum,
    mapping.strengthRaw,
  )
  const [minimum, setMinimum] = useState(initialMinimum)
  const [maximum, setMaximum] = useState(initialMaximum)
  const [sourcePositionValue, setSourcePositionValue] = useState(80)
  const [targetRaw, setTargetRaw] = useState(initialMaximum)
  const sourcePositionPercent = Math.min(
    100,
    (sourcePositionValue / sourceFullScaleValue) * 100,
  )
  const calibratedStrength = calibrateControlMappingStrengthRaw(
    minimum,
    sourcePositionPercent,
    targetRaw,
  )
  const calibratedMaximum = controlMappingMaximumRaw(
    minimum,
    calibratedStrength,
  )
  const calibratedPreviewRaw = controlMappingTargetRawAtSourcePercent(
    minimum,
    calibratedStrength,
    sourcePositionPercent,
  )
  const saturates = targetRaw > calibratedPreviewRaw
  const targetName = targetModule?.name ?? 'Unknown Module'
  const formatTargetValue = (rawValue: number) =>
    parameter ? formatParameterValue(rawValue, parameter) : `${rawValue} raw`

  const commitRange = () => {
    if (minimum !== initialMinimum || maximum !== initialMaximum)
      onSetRange(mapping.id, minimum, maximum)
  }

  return (
    <div className="mapping-table__row">
      <div className="mapping-table__target">
        <strong>{targetName}</strong>
        <span>{target?.name ?? mapping.targetEndpoint}</span>
        <small>End at {saturationSourcePercent.toFixed(1)}% source</small>
      </div>
      <label className="mapping-table__value">
        <span className="sr-only">{targetName} minimum raw value</span>
        <input
          aria-label={`${targetName} minimum raw value`}
          type="number"
          min="0"
          max={maximum}
          value={minimum}
          onChange={(event) => setMinimum(clampRaw(Number(event.target.value)))}
          onBlur={commitRange}
        />
        <small>{formatTargetValue(minimum)}</small>
      </label>
      <label className="mapping-table__value">
        <span className="sr-only">{targetName} maximum raw value</span>
        <input
          aria-label={`${targetName} maximum raw value`}
          type="number"
          min={minimum}
          max="65535"
          value={maximum}
          onChange={(event) => setMaximum(clampRaw(Number(event.target.value)))}
          onBlur={commitRange}
        />
        <small>{formatTargetValue(maximum)}</small>
      </label>
      <div className="mapping-table__calibration">
        <label>
          <span className="sr-only">{targetName} controller position</span>
          <span>CC</span>
          <input
            aria-label={`${targetName} controller position`}
            type="number"
            min="1"
            max="127"
            value={sourcePositionValue}
            onChange={(event) =>
              setSourcePositionValue(Math.min(127, Math.max(1, Number(event.target.value))))
            }
          />
        </label>
        <span>→</span>
        <label>
          <span className="sr-only">{targetName} calibration target raw value</span>
          <input
            aria-label={`${targetName} calibration target raw value`}
            type="number"
            min={minimum}
            max="65535"
            value={targetRaw}
            onChange={(event) =>
              setTargetRaw(Math.max(minimum, clampRaw(Number(event.target.value))))
            }
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setMaximum(calibratedMaximum)
            onSetStrength(mapping.id, calibratedStrength)
          }}
        >
          Set
        </button>
        {saturates ? (
          <small>Clamps at {formatTargetValue(calibratedPreviewRaw)}</small>
        ) : null}
      </div>
      <button
        type="button"
        className="mapping-table__remove"
        onClick={() => onRemove(mapping.id)}
        aria-label={`Remove mapping to ${targetName}`}
      >
        ×
      </button>
    </div>
  )
}
