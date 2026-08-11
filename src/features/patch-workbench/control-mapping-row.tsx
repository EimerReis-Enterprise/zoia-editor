import {
  calibrateControlMappingMaximumRaw,
  controlMappingRawValueAtPercent,
} from '#/lib/domain/patch'
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
  onRemove,
}: ControlMappingRowProps) {
  const initialMinimum =
    typeof parameter?.rawValue === 'number' ? parameter.rawValue : 0
  const initialMaximum = Math.min(65_535, initialMinimum + mapping.strengthRaw)
  const [minimum, setMinimum] = useState(initialMinimum)
  const [maximum, setMaximum] = useState(initialMaximum)
  const [sourcePositionValue, setSourcePositionValue] = useState(80)
  const [targetRaw, setTargetRaw] = useState(initialMaximum)
  const sourcePositionPercent = Math.min(
    100,
    (sourcePositionValue / sourceFullScaleValue) * 100,
  )
  const calibratedMaximum = calibrateControlMappingMaximumRaw(
    minimum,
    sourcePositionPercent,
    targetRaw,
  )
  const calibratedPreviewRaw = controlMappingRawValueAtPercent(
    minimum,
    calibratedMaximum,
    sourcePositionPercent,
  )
  const saturates = targetRaw > calibratedPreviewRaw
  const targetName = targetModule?.name ?? 'Unknown Module'

  const commitRange = () => onSetRange(mapping.id, minimum, maximum)

  return (
    <div className="mapping-table__row">
      <div className="mapping-table__target">
        <strong>{targetName}</strong>
        <span>{target?.name ?? mapping.targetEndpoint}</span>
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
          onClick={() => onSetRange(mapping.id, minimum, calibratedMaximum)}
        >
          Set
        </button>
        {saturates ? (
          <small>Clamps at {calibratedPreviewRaw}</small>
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
