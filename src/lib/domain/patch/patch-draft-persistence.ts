import { z } from 'zod'

import { readDraftSession, writeDraftSession } from '#/lib/infra/draft-storage'
import { createMutation, createQuery } from '#/lib/utils'

import {
  DEFAULT_ZOIA_MODULE_COLOR_ID,
  isZoiaModuleColorId,
} from './patch-colors'
import type { ZoiaModuleColorId } from './patch-colors'
import type { PatchDraft } from './patch-draft'

const draftModuleSchema = z.object({
  id: z.string(),
  catalogId: z.string(),
  name: z.string(),
  colorId: z
    .custom<ZoiaModuleColorId>(isZoiaModuleColorId)
    .default(DEFAULT_ZOIA_MODULE_COLOR_ID),
  rawParameters: z.record(z.string(), z.number().int().min(0).max(65_535)),
})

const draftConnectionSchema = z.object({
  id: z.string(),
  sourceModuleId: z.string(),
  targetModuleId: z.string(),
})

const patchDraftSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  modules: z.array(draftModuleSchema),
  connections: z.array(draftConnectionSchema),
  nextModuleSequence: z.number().int().nonnegative(),
  nextConnectionSequence: z.number().int().nonnegative(),
})

const patchDraftSessionSchema = z.object({
  savedAt: z.string(),
  draft: patchDraftSchema,
  history: z.array(patchDraftSchema).max(20),
})

export type PatchDraftSession = {
  savedAt: string
  draft: PatchDraft
  history: PatchDraft[]
}

export const loadPatchDraftSession = createQuery({
  execute: async (): Promise<PatchDraftSession | null> => {
    const value = await readDraftSession()
    if (value === null) return null
    const result = patchDraftSessionSchema.safeParse(value)
    return result.success ? result.data : null
  },
  key: () => ['patch', 'draft-session'] as const,
})

export const savePatchDraftSession = createMutation({
  execute: async (session: PatchDraftSession): Promise<void> => {
    await writeDraftSession({
      ...session,
      history: session.history.slice(-20),
    })
  },
  key: () => ['patch', 'draft-session', 'save'] as const,
})
