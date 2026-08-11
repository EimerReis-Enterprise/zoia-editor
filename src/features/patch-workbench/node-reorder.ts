export type NodeDropTarget = {
  afterModuleId: string
  beforeModuleId: string
}

export function nodeDropTarget(
  orderedModuleIds: readonly string[],
  centerXByModuleId: Readonly<Record<string, number>>,
  draggedModuleId: string,
  droppedCenterX: number,
): NodeDropTarget | null {
  const draggedIndex = orderedModuleIds.indexOf(draggedModuleId)
  if (draggedIndex <= 0 || draggedIndex >= orderedModuleIds.length - 1) return null

  const currentAfterModuleId = orderedModuleIds[draggedIndex - 1]
  const currentBeforeModuleId = orderedModuleIds[draggedIndex + 1]
  const remainingIds = orderedModuleIds.filter((moduleId) => moduleId !== draggedModuleId)
  const firstModuleToRightIndex = remainingIds.findIndex(
    (moduleId) => (centerXByModuleId[moduleId] ?? Number.POSITIVE_INFINITY) > droppedCenterX,
  )
  const insertionIndex = Math.max(
    1,
    Math.min(
      remainingIds.length - 1,
      firstModuleToRightIndex < 0 ? remainingIds.length - 1 : firstModuleToRightIndex,
    ),
  )
  const afterModuleId = remainingIds[insertionIndex - 1]
  const beforeModuleId = remainingIds[insertionIndex]
  if (
    afterModuleId === currentAfterModuleId &&
    beforeModuleId === currentBeforeModuleId
  ) return null

  return { afterModuleId, beforeModuleId }
}
