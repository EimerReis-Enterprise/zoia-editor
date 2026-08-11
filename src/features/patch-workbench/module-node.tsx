import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { AudioLines, CircleGauge, RadioTower } from 'lucide-react'
import type { CSSProperties } from 'react'

import {
  DEFAULT_ZOIA_MODULE_COLOR_ID,
  ZOIA_MODULE_COLORS,
} from '#/lib/domain/patch'
import type { PatchDocumentModule, PatchModule } from '#/lib/domain/patch'

const iconForType = (type: string) => {
  if (
    type.toLowerCase().includes('input') ||
    type.toLowerCase().includes('output')
  ) {
    return RadioTower
  }
  if (
    type.toLowerCase().includes('compress') ||
    type.toLowerCase().includes('limit')
  ) {
    return CircleGauge
  }
  return AudioLines
}

type Endpoint = PatchDocumentModule['endpoints'][number]

function isInput(endpoint: Endpoint) {
  return endpoint.kind === 'audioInput' || endpoint.kind === 'cvInput'
}

function isOutput(endpoint: Endpoint) {
  return endpoint.kind === 'audioOutput' || endpoint.kind === 'cvOutput'
}

function EndpointRail({
  endpoints,
  moduleName,
  direction,
  connectable,
}: {
  endpoints: Endpoint[]
  moduleName: string
  direction: 'input' | 'output'
  connectable: boolean
}) {
  const position = direction === 'input' ? Position.Left : Position.Right
  return (
    <div className={`module-endpoints module-endpoints--${direction}`}>
      {endpoints.map((endpoint) => {
        const signalKind = endpoint.kind.startsWith('audio') ? 'audio' : 'cv'
        return (
          <div
            className={`module-endpoint module-endpoint--${signalKind}`}
            key={endpoint.id}
          >
            <Handle
              id={endpoint.id}
              type={direction === 'input' ? 'target' : 'source'}
              position={position}
              className={`module-handle module-handle--${signalKind}`}
              isConnectable={connectable}
              aria-label={`${moduleName} ${endpoint.name} ${direction === 'input' ? 'inlet' : 'outlet'}`}
            />
            <span title={endpoint.name}>{endpoint.name}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ModuleNode({ data, selected }: NodeProps) {
  const module = data.module as PatchModule
  const documentModule = data.documentModule as PatchDocumentModule | undefined
  const canConnectEndpoints = Boolean(data.canConnectEndpoints)
  const Icon = iconForType(module.type)
  const color =
    ZOIA_MODULE_COLORS.find(
      (candidate) =>
        candidate.id === (module.colorId ?? DEFAULT_ZOIA_MODULE_COLOR_ID),
    ) ?? ZOIA_MODULE_COLORS[1]
  const inputs = documentModule?.endpoints.filter(isInput) ?? []
  const outputs = documentModule?.endpoints.filter(isOutput) ?? []
  const minimumHeight = Math.max(92, Math.max(inputs.length, outputs.length) * 22 + 38)

  return (
    <div
      className={`module-node ${selected ? 'is-selected' : ''} ${canConnectEndpoints ? 'is-connectable' : ''} is-draggable`}
      style={
        {
          '--module-color': color.hex,
          minHeight: minimumHeight,
        } as CSSProperties
      }
      aria-label={`${module.name}, ${color.name} Module`}
    >
      <span className="module-node__color" aria-hidden="true" />
      {documentModule ? (
        <EndpointRail
          endpoints={inputs}
          moduleName={module.name}
          direction="input"
          connectable={canConnectEndpoints}
        />
      ) : module.type !== 'Audio Input' ? (
        <Handle
          id="audio-in"
          type="target"
          position={Position.Left}
          className="module-handle module-handle--audio"
          isConnectable={false}
        />
      ) : null}
      <div className="module-node__body">
        <div className="module-node__index">
          M{String(module.moduleId).padStart(2, '0')}
        </div>
        <Icon aria-hidden="true" size={18} strokeWidth={1.5} />
        <div className="module-node__copy">
          <strong>{module.name}</strong>
          <span>{module.type}</span>
        </div>
      </div>
      {documentModule ? (
        <EndpointRail
          endpoints={outputs}
          moduleName={module.name}
          direction="output"
          connectable={canConnectEndpoints}
        />
      ) : module.type !== 'Audio Output' ? (
        <Handle
          id="audio-out"
          type="source"
          position={Position.Right}
          className="module-handle module-handle--audio"
          isConnectable={false}
        />
      ) : null}
    </div>
  )
}
