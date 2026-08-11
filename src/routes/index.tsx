import { createFileRoute } from '@tanstack/react-router'

import { PatchWorkbench } from '#/features/patch-workbench'

export const Route = createFileRoute('/')({ component: PatchVisualizer })

function PatchVisualizer() {
  return <PatchWorkbench />
}
