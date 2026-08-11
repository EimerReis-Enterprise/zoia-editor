import { ArrowRight, Cable, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import {
  calibrateControlMappingMaximumRaw,
  controlMappingRawValueAtPercent,
} from '#/lib/domain/patch'
import type {
  PatchDocument,
  PatchDocumentConnection,
  PatchDocumentModule,
} from '#/lib/domain/patch'

const clampRaw = (value: number) => Math.min(65_535, Math.max(0, value))

type ConnectionInspectorProps = {
  document: PatchDocument
  connection: PatchDocumentConnection
  canEdit: boolean
  sourceFullScaleValue: number
  onSetRange: (
    connectionId: string,
    minimumRaw: number,
    maximumRaw: number,
  ) => void
  onSetStrength: (connectionId: string, strengthRaw: number) => void
  onSetSourceCalibration: (
    moduleId: string,
    endpointId: string,
    fullScaleControllerValue: number,
  ) => void
  onRemove: (connectionId: string) => void
  onClose: () => void
}

function endpoint(
  module: PatchDocumentModule | undefined,
  endpointId: string,
) {
  return module?.endpoints.find((candidate) => candidate.id === endpointId)
}

export function ConnectionInspector({
  document,
  connection,
  canEdit,
  sourceFullScaleValue,
  onSetRange,
  onSetStrength,
  onSetSourceCalibration,
  onRemove,
  onClose,
}: ConnectionInspectorProps) {
  const sourceModule = document.modules.find(
    (module) => module.id === connection.sourceModuleId,
  )
  const targetModule = document.modules.find(
    (module) => module.id === connection.targetModuleId,
  )
  const source = endpoint(sourceModule, connection.sourceEndpointId)
  const target = endpoint(targetModule, connection.targetEndpointId)
  const targetParameter = targetModule?.parameters.find(
    (parameter) =>
      parameter.kind === 'parameter' && parameter.key === target?.key,
  )
  const initialMinimum =
    typeof targetParameter?.rawValue === 'number'
      ? targetParameter.rawValue
      : 0
  const initialMaximum = clampRaw(initialMinimum + connection.strengthRaw)
  const [minimum, setMinimum] = useState(initialMinimum)
  const [maximum, setMaximum] = useState(initialMaximum)
  const [strength, setStrength] = useState(connection.strengthRaw)
  const [controllerPosition, setControllerPosition] = useState(80)
  const [calibrationTarget, setCalibrationTarget] = useState(initialMaximum)
  const sourcePositionPercent = Math.min(
    100,
    (controllerPosition / sourceFullScaleValue) * 100,
  )
  const calibratedMaximum = calibrateControlMappingMaximumRaw(
    minimum,
    sourcePositionPercent,
    calibrationTarget,
  )
  const calibratedPreview = controlMappingRawValueAtPercent(
    minimum,
    calibratedMaximum,
    sourcePositionPercent,
  )
  const canSetRange =
    connection.kind === 'cv' && typeof targetParameter?.rawValue === 'number'

  const commitRange = () => {
    if (canEdit && canSetRange) onSetRange(connection.id, minimum, maximum)
  }
  const commitStrength = () => {
    if (canEdit) onSetStrength(connection.id, strength)
  }

  return (
    <aside
      className="connection-inspector"
      aria-label={`${sourceModule?.name ?? 'Unknown'} to ${targetModule?.name ?? 'Unknown'} Connection Inspector`}
    >
      <header className="connection-inspector__header">
        <div>
          <span><Cable size={13} /> CONNECTION</span>
          <h2>{connection.kind.toUpperCase()} routing</h2>
          <p>{connection.id}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close Connection Inspector"
        >
          <X size={18} />
        </button>
      </header>

      <section className="connection-route" aria-label="Connection route">
        <div>
          <small>SOURCE · OUTLET</small>
          <strong>{sourceModule?.name ?? 'Unknown Module'}</strong>
          <span>{source?.name ?? connection.sourceEndpoint}</span>
        </div>
        <ArrowRight size={20} aria-hidden="true" />
        <div>
          <small>TARGET · INLET</small>
          <strong>{targetModule?.name ?? 'Unknown Module'}</strong>
          <span>{target?.name ?? connection.targetEndpoint}</span>
        </div>
      </section>

      <dl className="connection-facts">
        <div><dt>Signal</dt><dd>{connection.kind}</dd></div>
        <div><dt>Strength</dt><dd>{connection.strengthRaw} raw</dd></div>
        <div><dt>Amount</dt><dd>{(connection.strengthRaw / 100).toFixed(2)}%</dd></div>
      </dl>

      {canSetRange ? (
        <section className="connection-range" aria-labelledby="connection-range-title">
          <div className="connection-section-heading">
            <div>
              <h3 id="connection-range-title">Target range</h3>
              <p>{targetParameter.name} · raw 0–65535</p>
            </div>
            <strong>{minimum} → {maximum}</strong>
          </div>
          <div className="connection-range__controls">
            <label>
              <span>START</span>
              <input
                type="range"
                min="0"
                max={maximum}
                value={minimum}
                disabled={!canEdit}
                onChange={(event) => setMinimum(clampRaw(Number(event.target.value)))}
                onPointerUp={commitRange}
                onKeyUp={commitRange}
              />
              <input
                type="number"
                min="0"
                max={maximum}
                value={minimum}
                disabled={!canEdit}
                onChange={(event) => setMinimum(clampRaw(Number(event.target.value)))}
                onBlur={commitRange}
              />
            </label>
            <label>
              <span>END</span>
              <input
                type="range"
                min={minimum}
                max="65535"
                value={maximum}
                disabled={!canEdit}
                onChange={(event) => setMaximum(clampRaw(Number(event.target.value)))}
                onPointerUp={commitRange}
                onKeyUp={commitRange}
              />
              <input
                type="number"
                min={minimum}
                max="65535"
                value={maximum}
                disabled={!canEdit}
                onChange={(event) => setMaximum(clampRaw(Number(event.target.value)))}
                onBlur={commitRange}
              />
            </label>
          </div>

          <div className="connection-calibration">
            <div className="connection-section-heading">
              <div>
                <h3>Response calibration</h3>
                <p>Set a musical target at a controller position.</p>
              </div>
            </div>
            <div className="connection-calibration__controls">
              <label><span>CC</span><input type="number" min="1" max="127" value={controllerPosition} onChange={(event) => setControllerPosition(Math.min(127, Math.max(1, Number(event.target.value))))} /></label>
              <span>→</span>
              <label><span>TARGET RAW</span><input type="number" min={minimum} max="65535" value={calibrationTarget} onChange={(event) => setCalibrationTarget(Math.max(minimum, clampRaw(Number(event.target.value))))} /></label>
              <button type="button" disabled={!canEdit} onClick={() => onSetRange(connection.id, minimum, calibratedMaximum)}>Set range</button>
            </div>
            {calibrationTarget > calibratedPreview ? <small>Response saturates at {calibratedPreview} raw.</small> : null}
          </div>

          <label className="connection-source-calibration">
            <span>SOURCE REACHES FULL CV AT</span>
            <input
              type="number"
              min="1"
              max="127"
              value={sourceFullScaleValue}
              disabled={!canEdit || !source}
              onChange={(event) => {
                if (!sourceModule || !source) return
                onSetSourceCalibration(
                  sourceModule.id,
                  source.id,
                  Number(event.target.value),
                )
              }}
            />
            <strong>/ 127</strong>
          </label>
        </section>
      ) : (
        <section className="connection-strength" aria-labelledby="connection-strength-title">
          <div className="connection-section-heading">
            <div>
              <h3 id="connection-strength-title">Connection strength</h3>
              <p>Hardware routing amount.</p>
            </div>
            <strong>{strength} raw</strong>
          </div>
          <input
            aria-label="Connection strength"
            type="range"
            min="0"
            max="65535"
            value={strength}
            disabled={!canEdit}
            onChange={(event) => setStrength(clampRaw(Number(event.target.value)))}
            onPointerUp={commitStrength}
            onKeyUp={commitStrength}
          />
          <input
            aria-label="Connection strength raw value"
            type="number"
            min="0"
            max="65535"
            value={strength}
            disabled={!canEdit}
            onChange={(event) => setStrength(clampRaw(Number(event.target.value)))}
            onBlur={commitStrength}
          />
        </section>
      )}

      <footer className="connection-inspector__actions">
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => onRemove(connection.id)}
        >
          <Trash2 size={14} /> Remove Connection
        </button>
        <small>Drag either endpoint on the canvas to reroute.</small>
      </footer>
    </aside>
  )
}
