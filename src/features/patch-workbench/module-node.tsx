import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { AudioLines, CircleGauge, RadioTower } from 'lucide-react'
import type { CSSProperties } from 'react'

import {
  DEFAULT_ZOIA_MODULE_COLOR_ID,
  ZOIA_MODULE_COLORS,
} from '#/lib/domain/patch'
import type { PatchModule } from '#/lib/domain/patch'

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

export function ModuleNode({ data, selected, isConnectable }: NodeProps) {
  const module = data.module as PatchModule
  const canDrag = Boolean(data.canDrag)
  const Icon = iconForType(module.type)
  const isAudioInput = module.type === 'Audio Input'
  const isAudioOutput = module.type === 'Audio Output'
  const color =
    ZOIA_MODULE_COLORS.find(
      (candidate) =>
        candidate.id === (module.colorId ?? DEFAULT_ZOIA_MODULE_COLOR_ID),
    ) ?? ZOIA_MODULE_COLORS[1]

  return (
    <div
      className={`module-node ${selected ? 'is-selected' : ''} ${isConnectable ? 'is-connectable' : ''} ${canDrag ? 'is-draggable' : ''}`}
      style={{ '--module-color': color.hex } as CSSProperties}
      aria-label={`${module.name}, ${color.name} Module`}
    >
      <span className="module-node__color" aria-hidden="true" />
      {!isAudioInput ? (
        <Handle
          id="audio-in"
          type="target"
          position={Position.Left}
          className="module-handle"
          isConnectable={isConnectable}
          aria-label={`${module.name} audio input`}
        />
      ) : null}
      <div className="module-node__index">
        M{String(module.moduleId).padStart(2, '0')}
      </div>
      <Icon aria-hidden="true" size={18} strokeWidth={1.5} />
      <div className="module-node__copy">
        <strong>{module.name}</strong>
        <span>{module.type}</span>
      </div>
      {!isAudioOutput ? (
        <Handle
          id="audio-out"
          type="source"
          position={Position.Right}
          className="module-handle"
          isConnectable={isConnectable}
          aria-label={`${module.name} audio output`}
        />
      ) : null}
    </div>
  )
}
