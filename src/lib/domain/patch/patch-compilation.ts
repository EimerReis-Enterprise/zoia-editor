import { z } from 'zod'

import {
  compileImportedPatchBinary,
  compilePatchDocumentBinary,
  compilePatchDraftBinary,
} from '#/lib/infra/parser-api'
import { createMutation } from '#/lib/utils'

import type { PatchDocument } from './patch-document'
import type { PatchDraft } from './patch-draft'
import type { ParameterEdit } from './patch-editing'

const validationFindingSchema = z.object({
  severity: z.enum(['warning', 'error']),
  code: z.string(),
  message: z.string(),
  moduleId: z.number().nullable(),
  parameterName: z.string().nullable(),
})

const compilationPayloadSchema = z.object({
  draftRevision: z.number(),
  outputFilename: z.string(),
  binaryBase64: z.string().nullable(),
  findings: z.array(validationFindingSchema),
  conformance: z.object({
    unchangedFieldsPreserved: z.boolean(),
    changedParameterCount: z.number(),
  }),
})

export type ValidationFinding = z.infer<typeof validationFindingSchema>
export type PatchCompilation = {
  draftRevision: number
  outputFilename: string
  binary: Uint8Array<ArrayBuffer> | null
  findings: ValidationFinding[]
  conformance: {
    unchangedFieldsPreserved: boolean
    changedParameterCount: number
  }
}

function decodeBinary(value: string | null): Uint8Array<ArrayBuffer> | null {
  if (value === null) return null
  const decoded = window.atob(value)
  const binary = new Uint8Array(new ArrayBuffer(decoded.length))
  for (let index = 0; index < decoded.length; index += 1) {
    binary[index] = decoded.charCodeAt(index)
  }
  return binary
}

function parseCompilation(payload: unknown): PatchCompilation {
  const result = compilationPayloadSchema.safeParse(payload)
  if (!result.success) {
    throw new Error('The compiler returned an unsupported compilation result.')
  }
  return {
    ...result.data,
    binary: decodeBinary(result.data.binaryBase64),
  }
}

export const compilePatchDocument = createMutation({
  execute: async (
    params: { document: PatchDocument; patchRevision: number },
    options?: { signal?: AbortSignal },
  ): Promise<PatchCompilation> => {
    const payload = await compilePatchDocumentBinary(
      params.document,
      params.patchRevision,
      options,
    )
    return parseCompilation(payload)
  },
  key: (patchRevision: number) =>
    ['patch-document', 'compile', { patchRevision }] as const,
})

export const compileImportedPatch = createMutation({
  execute: async (
    params: {
      file: File
      draftRevision: number
      parameterEdits: readonly ParameterEdit[]
    },
    options?: { signal?: AbortSignal },
  ): Promise<PatchCompilation> => {
    const payload = await compileImportedPatchBinary(
      params.file,
      params.draftRevision,
      params.parameterEdits,
      options,
    )
    return parseCompilation(payload)
  },
  key: (draftRevision: number) =>
    ['patch', 'compile-imported', { draftRevision }] as const,
})

export const compilePatchDraft = createMutation({
  execute: async (
    params: { draft: PatchDraft; draftRevision: number },
    options?: { signal?: AbortSignal },
  ): Promise<PatchCompilation> => {
    const payload = await compilePatchDraftBinary(
      params.draft,
      params.draftRevision,
      options,
    )
    return parseCompilation(payload)
  },
  key: (draftRevision: number) =>
    ['patch', 'compile-draft', { draftRevision }] as const,
})
