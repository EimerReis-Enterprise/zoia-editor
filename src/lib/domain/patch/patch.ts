import { z } from 'zod'

import { uploadPatchBinary } from '#/lib/infra/parser-api'
import { createMutation } from '#/lib/utils'

import { parsePatchDocument, projectPatchDocument } from './patch-document'
import type { PatchDocument } from './patch-document'

const patchParameterSchema = z.object({
  id: z.string(),
  key: z.string(),
  kind: z.enum(['parameter', 'option']),
  name: z.string(),
  displayValue: z.string(),
  rawValue: z.union([z.string(), z.number(), z.null()]),
  decoded: z.boolean(),
})

const patchModuleSchema = z.object({
  id: z.string(),
  moduleId: z.number(),
  name: z.string(),
  type: z.string(),
  category: z.string(),
  page: z.number(),
  colorId: z.number().int().min(1).max(15).optional(),
  parameters: z.array(patchParameterSchema),
  incomingConnectionIds: z.array(z.string()),
  outgoingConnectionIds: z.array(z.string()),
})

const patchConnectionSchema = z.object({
  id: z.string(),
  sourceModuleId: z.string(),
  targetModuleId: z.string(),
  sourceEndpoint: z.string(),
  targetEndpoint: z.string(),
  strength: z.number(),
  kind: z.enum(['audio', 'cv', 'midi', 'unknown']).optional(),
})

const patchProjectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceFilename: z.string(),
  modules: z.array(patchModuleSchema),
  connections: z.array(patchConnectionSchema),
  stats: z.object({
    moduleCount: z.number(),
    audioConnectionCount: z.number(),
    pageCount: z.number(),
  }),
})

export type PatchProjection = z.infer<typeof patchProjectionSchema>
export type PatchModule = z.infer<typeof patchModuleSchema>
export type PatchConnection = z.infer<typeof patchConnectionSchema>

async function sha256Base64(value: string): Promise<string> {
  const decoded = window.atob(value)
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index += 1)
    bytes[index] = decoded.charCodeAt(index)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const importPatchDocument = createMutation({
  execute: async (
    file: File,
    options?: { signal?: AbortSignal },
  ): Promise<PatchDocument> => {
    let payload: unknown
    if (file.name.toLowerCase().endsWith('.json')) {
      if (file.size > 5_242_880)
        throw new Error('The JSON file exceeds the 5 MB Patch Document limit.')
      try {
        payload = JSON.parse(await file.text()) as unknown
      } catch {
        throw new Error('The selected file does not contain valid JSON.')
      }
    } else {
      payload = await uploadPatchBinary(file, options)
    }
    const document = parsePatchDocument(payload)
    if (document.source) {
      const actualHash = await sha256Base64(document.source.binaryBase64)
      if (actualHash !== document.source.sha256) {
        throw new Error(
          'The embedded source binary does not match its SHA-256 checksum.',
        )
      }
    }
    return document
  },
  key: () => ['patch-document', 'import'] as const,
})

export function serializePatchDocument(document: PatchDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`
}

/** @deprecated Prefer importPatchDocument; retained while callers migrate. */
export const importPatch = createMutation({
  execute: async (
    file: File,
    options?: { signal?: AbortSignal },
  ): Promise<PatchProjection> =>
    projectPatchDocument(await importPatchDocument(file, options)),
  key: () => ['patch', 'import'] as const,
})

export function validatePatchProjection(value: unknown): PatchProjection {
  const result = patchProjectionSchema.safeParse(value)
  if (!result.success) throw new Error('The Patch Projection is invalid.')
  return result.data
}
