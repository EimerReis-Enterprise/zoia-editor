import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'

import type {
  PatchDocument,
  PatchProjection,
  WorkspaceLayout,
} from '#/lib/domain/patch'

const NODE_WIDTH = 220
const MINIMUM_NODE_HEIGHT = 92
const ENDPOINT_ROW_HEIGHT = 22

type LayoutPatchOptions = {
  canConnectEndpoints: boolean
  canInsertModules: boolean
  patchDocument: PatchDocument | null
  workspaceLayout?: WorkspaceLayout
  onInsertConnection: (connectionId: string) => void
}

function moduleHeight(documentModule: PatchDocument['modules'][number] | undefined) {
  if (!documentModule) return MINIMUM_NODE_HEIGHT
  const inputs = documentModule.endpoints.filter((endpoint) =>
    endpoint.kind.endsWith('Input'),
  ).length
  const outputs = documentModule.endpoints.filter((endpoint) =>
    endpoint.kind.endsWith('Output'),
  ).length
  return Math.max(MINIMUM_NODE_HEIGHT, Math.max(inputs, outputs) * ENDPOINT_ROW_HEIGHT + 38)
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
  graph.setGraph({ rankdir: 'LR', ranksep: 72, nodesep: 46, marginx: 72, marginy: 72 })
  const documentModules = new Map(
    options.patchDocument?.modules.map((module) => [module.id, module]) ?? [],
  )
  const documentConnections = new Map(
    options.patchDocument?.connections.map((connection) => [connection.id, connection]) ?? [],
  )

  for (const module of patch.modules) {
    graph.setNode(module.id, {
      width: NODE_WIDTH,
      height: moduleHeight(documentModules.get(module.id)),
    })
  }
  for (const connection of patch.connections) {
    graph.setEdge(connection.sourceModuleId, connection.targetModuleId)
  }

  dagre.layout(graph)

  const nodes: Node[] = patch.modules.map((module) => {
    const automaticPosition = graph.node(module.id) as {
      x: number
      y: number
      height: number
    }
    const savedPosition = options.workspaceLayout?.[module.id]
    return {
      id: module.id,
      type: 'module',
      position: savedPosition ?? {
        x: automaticPosition.x - NODE_WIDTH / 2,
        y: automaticPosition.y - automaticPosition.height / 2,
      },
      data: {
        module,
        documentModule: documentModules.get(module.id),
        canConnectEndpoints: options.canConnectEndpoints,
      },
      draggable: Boolean(options.patchDocument),
    }
  })

  const moduleNames = new Map(
    patch.modules.map((module) => [module.id, module.name]),
  )
  const edges: Edge[] = patch.connections.map((connection) => {
    const documentConnection = documentConnections.get(connection.id)
    const color = connection.kind === 'cv' ? '#d9a75f' : signalColor
    return {
      id: connection.id,
      source: connection.sourceModuleId,
      target: connection.targetModuleId,
      sourceHandle: documentConnection?.sourceEndpointId ?? 'audio-out',
      targetHandle: documentConnection?.targetEndpointId ?? 'audio-in',
      type: 'signal',
      animated: false,
      reconnectable: options.canConnectEndpoints,
      focusable: options.canConnectEndpoints,
      ariaLabel: `Connection from ${moduleNames.get(connection.sourceModuleId) ?? 'Module'} ${connection.sourceEndpoint} to ${moduleNames.get(connection.targetModuleId) ?? 'Module'} ${connection.targetEndpoint}`,
      data: {
        canInsert: options.canInsertModules,
        connectionKind: connection.kind ?? 'unknown',
        sourceName: moduleNames.get(connection.sourceModuleId) ?? 'Module',
        targetName: moduleNames.get(connection.targetModuleId) ?? 'Module',
        onInsert: options.onInsertConnection,
      },
      markerEnd: { type: 'arrowclosed' as const, color },
      style: { stroke: color },
    }
  })

  return { nodes, edges }
}
