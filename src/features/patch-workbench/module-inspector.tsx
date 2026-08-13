import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  FlaskConical,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { ControlMappingRow } from './control-mapping-row'
import {
  getHardwareVerifications,
  recordHardwareVerification,
} from '#/lib/infra/hardware-verification'
import type {
  HardwareTarget,
  HardwareVerificationRecord,
} from '#/lib/infra/hardware-verification'
import type { CSSProperties } from 'react'

import { formatParameterValue } from '#/lib/domain/parameter-value'
import {
  DEFAULT_ZOIA_MODULE_COLOR_ID,
  rawParameterValue,
  sourceCalibrationFullScaleValue,
  ZOIA_MODULE_COLORS,
} from '#/lib/domain/patch'
import type {
  ModuleCatalogEntry,
  ParameterEdit,
  PatchDocument,
  PatchDocumentModule,
  PatchProjection,
  ZoiaModuleColorId,
} from '#/lib/domain/patch'

type ModuleInspectorProps = {
  patch: PatchProjection
  patchDocument: PatchDocument | null
  moduleId: string
  parameterEdits: readonly ParameterEdit[]
  moduleCatalog: readonly ModuleCatalogEntry[]
  canEdit: boolean
  canRemove: boolean
  canRename: boolean
  canColorize: boolean
  experimentalMode: boolean
  hardwareTarget: HardwareTarget
  firmwareVersion: string
  verifiedBy: string
  onBeginParameterGesture: () => void
  onChangeParameter: (
    moduleId: number,
    parameterName: string,
    rawValue: number,
    originalRawValue: number,
  ) => void
  onCommitParameterGesture: () => void
  onRename: (name: string) => void
  onChangeColor: (colorId: ZoiaModuleColorId) => void
  onChangeExperimentalOption: (
    configuration: ModuleCatalogEntry,
    optionKey: string,
    optionIndex: number,
  ) => Promise<void>
  onCreateControlMapping: (mapping: {
    sourceModuleId: string
    sourceEndpointId: string
    targetModuleId: string
    targetEndpointId: string
    minimumRaw: number
    maximumRaw: number
  }) => void
  onSetControlMappingRange: (
    connectionId: string,
    minimumRaw: number,
    maximumRaw: number,
  ) => void
  onSetConnectionStrength: (
    connectionId: string,
    strengthRaw: number,
  ) => void
  onSetSourceCalibration: (
    moduleId: string,
    endpointId: string,
    fullScaleControllerValue: number,
  ) => void
  onRemoveConnection: (connectionId: string) => void
  onRemove: () => void
  onClose: () => void
}

export function ModuleInspector({
  patch,
  patchDocument,
  moduleId,
  parameterEdits,
  moduleCatalog,
  canEdit,
  canRemove,
  canRename,
  canColorize,
  experimentalMode,
  hardwareTarget,
  firmwareVersion,
  verifiedBy,
  onBeginParameterGesture,
  onChangeParameter,
  onCommitParameterGesture,
  onRename,
  onChangeColor,
  onChangeExperimentalOption,
  onCreateControlMapping,
  onSetControlMappingRange,
  onSetConnectionStrength,
  onSetSourceCalibration,
  onRemoveConnection,
  onRemove,
  onClose,
}: ModuleInspectorProps) {
  const [sourceEndpointValue, setSourceEndpointValue] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [minimumRaw, setMinimumRaw] = useState(0)
  const [maximumRaw, setMaximumRaw] = useState(65_535)
  const [verifications, setVerifications] = useState<
    HardwareVerificationRecord[]
  >([])
  const [verificationMenu, setVerificationMenu] = useState<{
    parameterKey: string
    parameterName: string
    x: number
    y: number
  } | null>(null)
  const [verificationNotes, setVerificationNotes] = useState('')
  const [verificationStatus, setVerificationStatus] = useState<string | null>(
    null,
  )
  const module = patch.modules.find((candidate) => candidate.id === moduleId)
  const documentModule = patchDocument?.modules.find(
    (candidate) => candidate.id === moduleId,
  )
  const storedExperimentalConfiguration =
    typeof documentModule?.opaque === 'object' && documentModule.opaque
      ? (documentModule.opaque as {
          experimentalConfiguration?: ModuleCatalogEntry
        }).experimentalConfiguration
      : undefined
  const moduleConfiguration =
    moduleCatalog.find(
      (configuration) => configuration.id === documentModule?.configurationId,
    ) ?? storedExperimentalConfiguration
  useEffect(() => {
    if (!experimentalMode) return
    void getHardwareVerifications()
      .then(setVerifications)
      .catch(() =>
        setVerificationStatus('Hardware evidence could not be loaded.'),
      )
  }, [experimentalMode])

  if (!module) return null

  const profileReady = Boolean(firmwareVersion.trim())
  const matchesProfile = (record: HardwareVerificationRecord) =>
    record.hardwareTarget === hardwareTarget &&
    record.firmwareVersion === firmwareVersion.trim()
  const configurationVerifications = verifications.filter(
    (record) =>
      record.configurationId === documentModule?.configurationId &&
      !record.parameterKey,
  )
  const verify = async (parameterKey?: string) => {
    if (!documentModule?.configurationId || !profileReady) return
    setVerificationStatus('Recording…')
    try {
      const record = await recordHardwareVerification({
        data: {
          configurationId: documentModule.configurationId,
          parameterKey,
          hardwareTarget,
          firmwareVersion: firmwareVersion.trim(),
          verifiedBy: verifiedBy.trim() || undefined,
          notes: verificationNotes.trim() || undefined,
        },
      })
      setVerifications((current) => [...current, record])
      setVerificationMenu(null)
      setVerificationNotes('')
      setVerificationStatus('Hardware verification recorded.')
    } catch (error) {
      setVerificationStatus(
        error instanceof Error ? error.message : 'Verification could not be saved.',
      )
    }
  }

  const incoming = patch.connections.filter((connection) =>
    module.incomingConnectionIds.includes(connection.id),
  )
  const outgoing = patch.connections.filter((connection) =>
    module.outgoingConnectionIds.includes(connection.id),
  )
  const moduleName = (id: string) =>
    patch.modules.find((candidate) => candidate.id === id)?.name ??
    'Unknown module'
  const sourceEndpoints =
    documentModule?.endpoints.filter(
      (endpoint) => endpoint.kind === 'cvOutput',
    ) ?? []
  const targetOptions =
    patchDocument?.modules.flatMap((targetModule) =>
      targetModule.endpoints
        .filter((endpoint) => endpoint.kind === 'cvInput')
        .map((endpoint) => {
          const parameter = targetModule.parameters.find(
            (candidate) =>
              candidate.kind === 'parameter' && candidate.key === endpoint.key,
          )
          return parameter && typeof parameter.rawValue === 'number'
            ? { targetModule, endpoint, parameter }
            : null
        })
        .filter(
          (
            candidate,
          ): candidate is {
            targetModule: PatchDocumentModule
            endpoint: PatchDocumentModule['endpoints'][number]
            parameter: PatchDocumentModule['parameters'][number]
          } => candidate !== null,
        ),
    ) ?? []
  const mappings =
    patchDocument?.connections.filter(
      (connection) =>
        connection.kind === 'cv' && connection.sourceModuleId === moduleId,
    ) ?? []
  const activeSourceEndpointId = sourceEndpointValue || sourceEndpoints[0]?.id
  const sourceFullScaleValue = activeSourceEndpointId
    ? sourceCalibrationFullScaleValue(
        patchDocument,
        moduleId,
        activeSourceEndpointId,
      )
    : 127
  const setTarget = (value: string) => {
    setTargetValue(value)
    const option = targetOptions.find(
      (candidate) =>
        `${candidate.targetModule.id}::${candidate.endpoint.id}` === value,
    )
    if (option && typeof option.parameter.rawValue === 'number') {
      setMinimumRaw(option.parameter.rawValue)
      setMaximumRaw(65_535)
    }
  }

  return (
    <aside className="inspector" aria-label={`${module.name} Module Inspector`}>
      <header className="inspector__header">
        <div>
          <span>MODULE {String(module.moduleId).padStart(2, '0')}</span>
          {canRename ? (
            <input
              className="module-name-input"
              defaultValue={module.name}
              key={`${module.id}-${module.name}`}
              maxLength={16}
              aria-label="Module name"
              onBlur={(event) => onRename(event.target.value)}
            />
          ) : (
            <h2>{module.name}</h2>
          )}
          <p>{module.type}</p>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onClose}
          aria-label="Close Module Inspector"
        >
          <X size={18} />
        </button>
      </header>

      <dl className="module-facts">
        <div>
          <dt>Category</dt>
          <dd>{module.category}</dd>
        </div>
        <div>
          <dt>Page</dt>
          <dd>{module.page + 1}</dd>
        </div>
        <div>
          <dt>Controls</dt>
          <dd>{module.parameters.length}</dd>
        </div>
      </dl>

      {experimentalMode ? (
        <section className="experimental-verification">
          <div className="experimental-verification__heading">
            <span><FlaskConical size={14} /> Experimental verification</span>
            {configurationVerifications.some(matchesProfile) ? (
              <strong><BadgeCheck size={14} /> Verified</strong>
            ) : (
              <strong>Untested</strong>
            )}
          </div>
          <p>
            {profileReady
              ? `${hardwareTarget === 'euroburo' ? 'Euroburo' : 'ZOIA Pedal'} · firmware ${firmwareVersion}`
              : 'Set a firmware version in the authoring toolbar first.'}
          </p>
          <label className="configuration-verification-notes">
            <span>CONFIGURATION TEST NOTES · OPTIONAL</span>
            <input
              value={verificationNotes}
              onChange={(event) => setVerificationNotes(event.target.value)}
              placeholder="Loaded, audio passed, endpoints correct…"
            />
          </label>
          <button
            type="button"
            disabled={!profileReady || !documentModule?.configurationId}
            onClick={() => void verify()}
          >
            Mark configuration verified
          </button>
          {verificationStatus ? <small role="status">{verificationStatus}</small> : null}
          {verifications.some(
            (record) => record.configurationId === documentModule?.configurationId,
          ) ? (
            <details className="verification-history">
              <summary>Hardware evidence</summary>
              <ul>
                {verifications
                  .filter(
                    (record) =>
                      record.configurationId === documentModule?.configurationId,
                  )
                  .slice(-5)
                  .reverse()
                  .map((record) => (
                    <li key={record.id}>
                      <strong>{record.parameterKey ?? 'Configuration'}</strong>
                      <span>
                        {record.hardwareTarget === 'euroburo'
                          ? 'Euroburo'
                          : 'ZOIA Pedal'}{' '}
                        · {record.firmwareVersion} ·{' '}
                        {new Date(record.verifiedAt).toLocaleDateString()}
                        {record.verifiedBy ? ` · ${record.verifiedBy}` : ''}
                      </span>
                      {record.notes ? <small>{record.notes}</small> : null}
                    </li>
                  ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      <section
        className="module-color-section"
        aria-labelledby="module-color-label"
      >
        <div className="module-color-section__heading">
          <h3 id="module-color-label">ZOIA module color</h3>
          <span>
            {
              ZOIA_MODULE_COLORS.find(
                (color) =>
                  color.id === (module.colorId ?? DEFAULT_ZOIA_MODULE_COLOR_ID),
              )?.name
            }
          </span>
        </div>
        <div className="module-color-palette">
          {ZOIA_MODULE_COLORS.map((color) => {
            const isSelected =
              color.id === (module.colorId ?? DEFAULT_ZOIA_MODULE_COLOR_ID)
            return (
              <button
                key={color.id}
                type="button"
                className="module-color-swatch"
                style={{ '--swatch-color': color.hex } as CSSProperties}
                aria-label={`Set Module color to ${color.name}`}
                aria-pressed={isSelected}
                disabled={!canColorize}
                onClick={() => onChangeColor(color.id)}
              >
                <span aria-hidden="true" />
              </button>
            )
          })}
        </div>
        {!canColorize ? (
          <p>Import as a Patch Document to change the hardware color.</p>
        ) : null}
      </section>

      {experimentalMode && moduleConfiguration?.options?.length ? (
        <section className="module-options" aria-labelledby="module-options-label">
          <h3 id="module-options-label">Configuration options</h3>
          {moduleConfiguration.options.map((option) => (
            <label key={option.key}>
              <span>{option.name}</span>
              <select
                aria-label={`${option.name} option`}
                value={option.values.findIndex(
                  (value) => value === option.selectedValue,
                )}
                onChange={(event) =>
                  void onChangeExperimentalOption(
                    moduleConfiguration,
                    option.key,
                    Number(event.target.value),
                  )
                }
              >
                {option.values.map((value, index) => (
                  <option key={`${option.key}-${String(value)}`} value={index}>
                    {String(value)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <p>
            Changing an option rebuilds the Experimental Module Configuration.
            Connections to endpoints removed by the new option are discarded.
          </p>
        </section>
      ) : null}

      {sourceEndpoints.length ? (
        <section className="mapping-section" aria-labelledby="mapping-label">
          <div className="mapping-section__heading">
            <h3 id="mapping-label">Mappings</h3>
            <span>{mappings.length} ACTIVE</span>
          </div>
          <label className="source-calibration">
            <span>CC REACHES FULL CV AT</span>
            <input
              aria-label="CC reaches full CV at"
              type="number"
              min="1"
              max="127"
              value={sourceFullScaleValue}
              disabled={!activeSourceEndpointId || !canEdit}
              onChange={(event) => {
                if (!activeSourceEndpointId) return
                onSetSourceCalibration(
                  moduleId,
                  activeSourceEndpointId,
                  Number(event.target.value),
                )
              }}
            />
            <strong>/ 127</strong>
          </label>
          <div className="mapping-table">
            <div className="mapping-table__header" aria-hidden="true">
              <span>Target</span>
              <span>Start</span>
              <span>End</span>
              <span>Calibration</span>
              <span />
            </div>
          {mappings.map((mapping) => {
            const targetModule = patchDocument?.modules.find(
              (candidate) => candidate.id === mapping.targetModuleId,
            )
            const target = targetModule?.endpoints.find(
              (candidate) => candidate.id === mapping.targetEndpointId,
            )
            const parameter = targetModule?.parameters.find(
              (candidate) =>
                candidate.kind === 'parameter' && candidate.key === target?.key,
            )
            return (
              <ControlMappingRow
                key={`${mapping.id}-${parameter?.rawValue ?? 0}-${mapping.strengthRaw}`}
                mapping={mapping}
                targetModule={targetModule}
                target={target}
                parameter={parameter}
                sourceFullScaleValue={sourceFullScaleValue}
                onSetRange={onSetControlMappingRange}
                onSetStrength={onSetConnectionStrength}
                onRemove={onRemoveConnection}
              />
            )
          })}
          </div>
          <div className="mapping-create">
            <label>
              <span>CONTROL OUTPUT</span>
              <select
                aria-label="Control output"
                value={sourceEndpointValue || sourceEndpoints[0]?.id || ''}
                onChange={(event) => setSourceEndpointValue(event.target.value)}
              >
                {sourceEndpoints.map((endpoint) => (
                  <option key={endpoint.id} value={endpoint.id}>
                    {endpoint.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>TARGET PARAMETER</span>
              <select
                aria-label="Target parameter"
                value={targetValue}
                onChange={(event) => setTarget(event.target.value)}
              >
                <option value="">Choose parameter…</option>
                {targetOptions.map(({ targetModule, endpoint }) => {
                  const mapped = patchDocument?.connections.some(
                    (connection) =>
                      connection.kind === 'cv' &&
                      connection.targetModuleId === targetModule.id &&
                      connection.targetEndpointId === endpoint.id,
                  )
                  return (
                    <option
                      key={`${targetModule.id}-${endpoint.id}`}
                      value={`${targetModule.id}::${endpoint.id}`}
                      disabled={mapped}
                    >
                      {targetModule.name} · {endpoint.name}
                      {mapped ? ' · mapped' : ''}
                    </option>
                  )
                })}
              </select>
            </label>
            <div className="mapping-create__range">
              <label>
                <span>MIN RAW</span>
                <input
                  aria-label="Mapping minimum raw value"
                  type="number"
                  min="0"
                  max="65535"
                  value={minimumRaw}
                  onChange={(event) =>
                    setMinimumRaw(
                      Math.min(
                        maximumRaw,
                        Math.max(0, Number(event.target.value)),
                      ),
                    )
                  }
                />
              </label>
              <label>
                <span>MAX RAW</span>
                <input
                  aria-label="Mapping maximum raw value"
                  type="number"
                  min="0"
                  max="65535"
                  value={maximumRaw}
                  onChange={(event) =>
                    setMaximumRaw(
                      Math.max(
                        minimumRaw,
                        Math.min(65_535, Number(event.target.value)),
                      ),
                    )
                  }
                />
              </label>
            </div>
            <button
              type="button"
              disabled={
                !targetValue ||
                !patchDocument ||
                patchDocument.authoringMode !== 'free'
              }
              onClick={() => {
                const [targetModuleId, targetEndpointId] =
                  targetValue.split('::')
                const sourceEndpointId =
                  sourceEndpointValue || sourceEndpoints[0]?.id
                if (!sourceEndpointId || !targetModuleId || !targetEndpointId)
                  return
                onCreateControlMapping({
                  sourceModuleId: moduleId,
                  sourceEndpointId,
                  targetModuleId,
                  targetEndpointId,
                  minimumRaw,
                  maximumRaw,
                })
                setTargetValue('')
              }}
            >
              Add mapping
            </button>
          </div>
        </section>
      ) : null}

      <section className="inspector__section">
        <h3>Parameters &amp; options</h3>
        {module.parameters.length ? (
          <div className="parameter-list">
            {module.parameters.map((parameter) => {
              const originalRawValue =
                typeof parameter.rawValue === 'number'
                  ? parameter.rawValue
                  : null
              const currentRawValue = rawParameterValue(
                patch,
                module.moduleId,
                parameter.key,
                parameterEdits,
              )
              const documentParameter = documentModule?.parameters.find(
                (candidate) => candidate.key === parameter.key,
              )
              const isEdited = currentRawValue !== originalRawValue
              const isEditable =
                canEdit &&
                parameter.kind === 'parameter' &&
                originalRawValue !== null
              const isVerified = verifications.some(
                (record) =>
                  record.configurationId === documentModule?.configurationId &&
                  record.parameterKey === parameter.key &&
                  matchesProfile(record),
              )

              return (
                <div
                  className={`parameter-row ${isEditable ? 'is-editable' : ''}`}
                  key={parameter.id}
                  onContextMenu={(event) => {
                    if (
                      !experimentalMode ||
                      !documentModule?.configurationId ||
                      parameter.kind !== 'parameter'
                    )
                      return
                    event.preventDefault()
                    setVerificationMenu({
                      parameterKey: parameter.key,
                      parameterName: parameter.name,
                      x: event.clientX,
                      y: event.clientY,
                    })
                    setVerificationNotes('')
                  }}
                >
                  <div className="parameter-row__summary">
                    <span>
                      {parameter.name}
                      {experimentalMode ? (
                        <small className={`verification-badge ${isVerified ? 'is-verified' : ''}`}>
                          {isVerified ? <BadgeCheck size={12} /> : null}
                          {parameter.kind === 'option'
                            ? 'Option'
                            : isVerified
                              ? 'Verified'
                              : 'Experimental'}
                        </small>
                      ) : null}
                    </span>
                    <div>
                      <strong>
                        {isEdited && currentRawValue !== null
                          ? formatParameterValue(
                              currentRawValue,
                              documentParameter ?? {},
                            )
                          : parameter.displayValue}
                      </strong>
                      {currentRawValue !== null ? (
                        <small>
                          {isEdited ? 'EDITED · ' : ''}RAW {currentRawValue}
                        </small>
                      ) : null}
                    </div>
                  </div>
                  {isEditable ? (
                    <div className="parameter-editor">
                      <input
                        aria-label={`${parameter.name} raw value`}
                        type="range"
                        min="0"
                        max="65535"
                        step="1"
                        value={currentRawValue ?? 0}
                        onPointerDown={onBeginParameterGesture}
                        onPointerUp={onCommitParameterGesture}
                        onFocus={onBeginParameterGesture}
                        onBlur={onCommitParameterGesture}
                        onChange={(event) =>
                          onChangeParameter(
                            module.moduleId,
                            parameter.key,
                            Number(event.target.value),
                            originalRawValue,
                          )
                        }
                      />
                      <input
                        aria-label={`${parameter.name} exact raw value`}
                        type="number"
                        min="0"
                        max="65535"
                        step="1"
                        value={currentRawValue ?? 0}
                        onFocus={onBeginParameterGesture}
                        onBlur={onCommitParameterGesture}
                        onChange={(event) =>
                          onChangeParameter(
                            module.moduleId,
                            parameter.key,
                            Math.min(
                              65_535,
                              Math.max(0, Number(event.target.value)),
                            ),
                            originalRawValue,
                          )
                        }
                      />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="muted-copy">This module has no exposed parameters.</p>
        )}
      </section>

      <section className="inspector__section connections-section">
        <h3>Audio connections</h3>
        {[
          ...incoming.map((connection) => ({
            id: connection.id,
            icon: ArrowDownLeft,
            label: `From ${moduleName(connection.sourceModuleId)}`,
            endpoint: `${connection.sourceEndpoint} → ${connection.targetEndpoint}`,
          })),
          ...outgoing.map((connection) => ({
            id: connection.id,
            icon: ArrowUpRight,
            label: `To ${moduleName(connection.targetModuleId)}`,
            endpoint: `${connection.sourceEndpoint} → ${connection.targetEndpoint}`,
          })),
        ].map(({ id, icon: Icon, label, endpoint }) => (
          <div className="connection-row" key={id}>
            <Icon size={16} aria-hidden="true" />
            <div>
              <strong>{label}</strong>
              <span>{endpoint}</span>
            </div>
          </div>
        ))}
        {!incoming.length && !outgoing.length ? (
          <p className="muted-copy">No audio connections detected.</p>
        ) : null}
      </section>

      {verificationMenu ? (
        <div
          className="verification-menu"
          role="dialog"
          aria-label={`Verify ${verificationMenu.parameterName}`}
          style={{
            left: Math.min(verificationMenu.x, window.innerWidth - 290),
            top: Math.min(verificationMenu.y, window.innerHeight - 250),
          }}
        >
          <div>
            <strong>{verificationMenu.parameterName}</strong>
            <button
              type="button"
              aria-label="Close verification menu"
              onClick={() => setVerificationMenu(null)}
            >
              <X size={14} />
            </button>
          </div>
          <p>
            {profileReady
              ? `Tested on ${hardwareTarget === 'euroburo' ? 'Euroburo' : 'ZOIA Pedal'} · ${firmwareVersion}`
              : 'Add the firmware version in the toolbar before verifying.'}
          </p>
          <label>
            <span>TEST NOTES · OPTIONAL</span>
            <textarea
              rows={3}
              value={verificationNotes}
              onChange={(event) => setVerificationNotes(event.target.value)}
              placeholder="Loaded, audio passed, CV response correct…"
            />
          </label>
          <button
            type="button"
            disabled={!profileReady}
            onClick={() => void verify(verificationMenu.parameterKey)}
          >
            <BadgeCheck size={14} /> Mark parameter verified
          </button>
        </div>
      ) : null}

      {canRemove ? (
        <footer className="inspector__actions">
          <button type="button" onClick={onRemove}>
            <Trash2 size={15} /> Remove from Signal Chain
          </button>
        </footer>
      ) : null}
    </aside>
  )
}
