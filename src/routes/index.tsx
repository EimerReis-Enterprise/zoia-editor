import { createFileRoute } from '@tanstack/react-router'

import { PatchWorkbench } from '#/features/patch-workbench'

export const Route = createFileRoute('/')({ component: PatchEditor })

function PatchEditor() {
  return <PatchWorkbench />
}
