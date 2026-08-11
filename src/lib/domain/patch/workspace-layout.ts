import type { PatchDocument } from './patch-document'

export const WORKSPACE_LAYOUT_EXTENSION_KEY =
  'zoia-editor.workspaceLayout.v1' as const

export type WorkspacePosition = { x: number; y: number }
export type WorkspaceLayout = Record<string, WorkspacePosition | undefined>

type WorkspaceLayoutExtension = {
  positions: WorkspaceLayout
}

function isFinitePosition(value: unknown): value is WorkspacePosition {
  if (!value || typeof value !== 'object') return false
  const position = value as Record<string, unknown>
  return (
    typeof position.x === 'number' &&
    Number.isFinite(position.x) &&
    typeof position.y === 'number' &&
    Number.isFinite(position.y)
  )
}

export function workspaceLayout(document: PatchDocument): WorkspaceLayout {
  const extension = document.extensions[WORKSPACE_LAYOUT_EXTENSION_KEY]
  if (!extension || typeof extension !== 'object') return {}
  const positions = (extension as { positions?: unknown }).positions
  if (!positions || typeof positions !== 'object') return {}
  return Object.fromEntries(
    Object.entries(positions).filter(
      (entry): entry is [string, WorkspacePosition] =>
        entry[0].length > 0 && isFinitePosition(entry[1]),
    ),
  )
}

export function setWorkspaceLayout(
  document: PatchDocument,
  positions: WorkspaceLayout,
): PatchDocument {
  const moduleIds = new Set(document.modules.map((module) => module.id))
  const validPositions = Object.fromEntries(
    Object.entries(positions).filter(
      ([moduleId, position]) => moduleIds.has(moduleId) && isFinitePosition(position),
    ),
  )
  const extension: WorkspaceLayoutExtension = { positions: validPositions }
  return {
    ...document,
    extensions: {
      ...document.extensions,
      [WORKSPACE_LAYOUT_EXTENSION_KEY]: extension,
    },
  }
}

export function setModuleWorkspacePosition(
  document: PatchDocument,
  moduleId: string,
  position: WorkspacePosition,
): PatchDocument {
  if (
    !document.modules.some((module) => module.id === moduleId) ||
    !isFinitePosition(position)
  )
    return document
  return setWorkspaceLayout(document, {
    ...workspaceLayout(document),
    [moduleId]: position,
  })
}

export function samePatchSemantics(
  left: PatchDocument,
  right: PatchDocument,
): boolean {
  const withoutWorkspaceLayout = (document: PatchDocument) => {
    const extensions = { ...document.extensions }
    delete extensions[WORKSPACE_LAYOUT_EXTENSION_KEY]
    return { ...document, extensions }
  }
  return (
    JSON.stringify(withoutWorkspaceLayout(left)) ===
    JSON.stringify(withoutWorkspaceLayout(right))
  )
}
