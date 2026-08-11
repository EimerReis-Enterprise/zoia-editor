import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react'
import type { Edge, EdgeProps } from '@xyflow/react'
import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export type SignalEdgeData = {
  canInsert: boolean
  connectionKind?: 'audio' | 'cv' | 'midi' | 'unknown'
  sourceName: string
  targetName: string
  onInsert: (connectionId: string) => void
} & Record<string, unknown>

type SignalEdgeType = Edge<SignalEdgeData, 'signal'>

export function SignalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  style,
  data,
}: EdgeProps<SignalEdgeType>) {
  const [isHovered, setIsHovered] = useState(false)
  const hideTimeout = useRef<number | null>(null)
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  useEffect(
    () => () => {
      if (hideTimeout.current !== null) window.clearTimeout(hideTimeout.current)
    },
    [],
  )

  const showInsertControl = () => {
    if (hideTimeout.current !== null) window.clearTimeout(hideTimeout.current)
    setIsHovered(true)
  }
  const scheduleHideInsertControl = () => {
    hideTimeout.current = window.setTimeout(() => setIsHovered(false), 100)
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        className={`signal-edge__path signal-edge__path--${data?.connectionKind ?? 'unknown'} ${selected ? 'is-selected' : ''}`}
      />
      <path
        d={edgePath}
        className="signal-edge__hit-area"
        onPointerEnter={data?.canInsert ? showInsertControl : undefined}
        onPointerLeave={data?.canInsert ? scheduleHideInsertControl : undefined}
      />
      {data?.canInsert ? (
        <>
          <EdgeLabelRenderer>
            <button
              type="button"
              className={`signal-edge__insert nodrag nopan ${isHovered || selected ? 'is-visible' : ''}`}
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              }}
              onPointerEnter={showInsertControl}
              onPointerLeave={scheduleHideInsertControl}
              onFocus={showInsertControl}
              onBlur={scheduleHideInsertControl}
              onClick={(event) => {
                event.stopPropagation()
                data.onInsert(id)
              }}
              aria-label={`Insert Module between ${data.sourceName} and ${data.targetName}`}
            >
              <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </EdgeLabelRenderer>
        </>
      ) : null}
    </>
  )
}
