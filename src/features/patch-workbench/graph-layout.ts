import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'

import type { PatchProjection } from '#/lib/domain/patch'

const NODE_WIDTH = 188
const NODE_HEIGHT = 92

type LayoutPatchOptions = {
  canEditConnections: boolean
  onInsertConnection: (connectionId: string) => void
}

export function layoutPatch(
  patch: PatchProjection,
  signalColor: string,
  options: LayoutPatchOptions,
): {
  nodes: Node[]
  edges: Edge[]
} {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'LR', ranksep: 54, nodesep: 44, marginx: 72, marginy: 72 })

  for (const module of patch.modules) {
    graph.setNode(module.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const connection of patch.connections) {
    graph.setEdge(connection.sourceModuleId, connection.targetModuleId)
  }

  dagre.layout(graph)

  const nodes: Node[] = patch.modules.map((module) => {
    const position = graph.node(module.id) as { x: number; y: number }
    const canDrag =
      options.canEditConnections &&
      module.type !== 'Audio Input' &&
      module.type !== 'Audio Output'
    return {
      id: module.id,
      type: 'module',
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
      data: { module, canEditConnections: options.canEditConnections, canDrag },
      draggable: canDrag,
    }
  })

  const moduleNames = new Map(
    patch.modules.map((module) => [module.id, module.name]),
  )
  const edges: Edge[] = patch.connections.map((connection) => ({
    id: connection.id,
    source: connection.sourceModuleId,
    target: connection.targetModuleId,
    sourceHandle: 'audio-out',
    targetHandle: 'audio-in',
    type: 'signal',
    animated: false,
    reconnectable: options.canEditConnections,
    focusable: options.canEditConnections,
    ariaLabel: `Connection from ${moduleNames.get(connection.sourceModuleId) ?? 'Module'} to ${moduleNames.get(connection.targetModuleId) ?? 'Module'}`,
    data: {
      canInsert: options.canEditConnections,
      sourceName: moduleNames.get(connection.sourceModuleId) ?? 'Module',
      targetName: moduleNames.get(connection.targetModuleId) ?? 'Module',
      onInsert: options.onInsertConnection,
    },
    markerEnd: { type: 'arrowclosed' as const, color: signalColor },
  }))

  return { nodes, edges }
}
