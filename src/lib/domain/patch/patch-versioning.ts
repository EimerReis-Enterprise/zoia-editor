import { z } from 'zod'

import { readPatchHistoryRecords, writePatchHistoryRecord } from '#/lib/infra/patch-history-storage'
import { createMutation, createQuery } from '#/lib/utils'

import { parsePatchDocument } from './patch-document'
import type { PatchDocument } from './patch-document'

export const PATCH_VERSION_EXTENSION_KEY = 'zoia-editor.patchVersion.v1' as const

const patchVersionMetadataSchema = z.object({
  seriesId: z.string().min(1),
  version: z.number().int().positive(),
  message: z.string().trim().min(1).max(120),
  savedAt: z.string().datetime(),
})

export type PatchVersionMetadata = z.infer<typeof patchVersionMetadataSchema>
export type PatchVersion = {
  metadata: PatchVersionMetadata
  document: PatchDocument
}
export type PatchChange = {
  kind: 'module' | 'parameter' | 'connection' | 'patch' | 'workspace'
  summary: string
}

export function patchVersionMetadata(
  document: PatchDocument,
): PatchVersionMetadata | null {
  const result = patchVersionMetadataSchema.safeParse(
    document.extensions[PATCH_VERSION_EXTENSION_KEY],
  )
  return result.success ? result.data : null
}

function documentContent(document: PatchDocument): string {
  const extensions = { ...document.extensions }
  delete extensions[PATCH_VERSION_EXTENSION_KEY]
  return JSON.stringify({ ...document, extensions })
}

export function samePatchVersionContent(
  left: PatchDocument,
  right: PatchDocument,
): boolean {
  return documentContent(left) === documentContent(right)
}

export function createPatchVersion(
  document: PatchDocument,
  history: readonly PatchVersion[],
  message: string,
  savedAt = new Date().toISOString(),
): PatchVersion {
  const normalizedMessage = message.trim()
  if (!normalizedMessage || normalizedMessage.length > 120) {
    throw new Error('Write a version summary of 1–120 characters.')
  }
  const currentMetadata = patchVersionMetadata(document)
  const seriesId = currentMetadata?.seriesId ?? document.documentId
  const version =
    Math.max(currentMetadata?.version ?? 0, ...history.map((item) => item.metadata.version), 0) + 1
  const metadata = patchVersionMetadataSchema.parse({
    seriesId,
    version,
    message: normalizedMessage,
    savedAt,
  })
  return {
    metadata,
    document: {
      ...document,
      extensions: {
        ...document.extensions,
        [PATCH_VERSION_EXTENSION_KEY]: metadata,
      },
    },
  }
}

export function versionedPatchFilename(name: string, version: number): string {
  const safeName = name.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'patch'
  return `${safeName}.v${String(version).padStart(3, '0')}.zoia.json`
}

export function parsePatchVersion(value: unknown): PatchVersion {
  const document = parsePatchDocument(value)
  const metadata = patchVersionMetadata(document)
  if (!metadata) throw new Error('This Patch Document has no version metadata.')
  return { metadata, document }
}

export function describePatchChanges(
  previous: PatchDocument | null,
  current: PatchDocument,
): PatchChange[] {
  if (!previous) return [{ kind: 'patch', summary: 'Initial Patch Version' }]
  const changes: PatchChange[] = []
  if (previous.name !== current.name) {
    changes.push({ kind: 'patch', summary: `Renamed “${previous.name}” to “${current.name}”` })
  }
  const previousModules = new Map(previous.modules.map((module) => [module.id, module]))
  const currentModules = new Map(current.modules.map((module) => [module.id, module]))
  for (const module of current.modules) {
    const before = previousModules.get(module.id)
    if (!before) {
      changes.push({ kind: 'module', summary: `Added ${module.name}` })
      continue
    }
    if (before.name !== module.name) {
      changes.push({ kind: 'module', summary: `Renamed ${before.name} to ${module.name}` })
    }
    const beforeParameters = new Map(before.parameters.map((parameter) => [parameter.key, parameter]))
    for (const parameter of module.parameters) {
      const oldParameter = beforeParameters.get(parameter.key)
      if (oldParameter && oldParameter.rawValue !== parameter.rawValue) {
        changes.push({
          kind: 'parameter',
          summary: `${module.name} · ${parameter.name}: ${oldParameter.displayValue} → ${parameter.displayValue}`,
        })
      }
    }
  }
  for (const module of previous.modules) {
    if (!currentModules.has(module.id)) {
      changes.push({ kind: 'module', summary: `Removed ${module.name}` })
    }
  }
  const connectionLabel = (document: PatchDocument, id: string) => {
    const connection = document.connections.find((candidate) => candidate.id === id)
    if (!connection) return 'Connection'
    const source = document.modules.find((module) => module.id === connection.sourceModuleId)?.name
    const target = document.modules.find((module) => module.id === connection.targetModuleId)?.name
    return `${source ?? connection.sourceEndpoint} → ${target ?? connection.targetEndpoint}`
  }
  const previousConnections = new Set(previous.connections.map((connection) => connection.id))
  const currentConnections = new Set(current.connections.map((connection) => connection.id))
  for (const connection of current.connections) {
    if (!previousConnections.has(connection.id)) {
      changes.push({ kind: 'connection', summary: `Connected ${connectionLabel(current, connection.id)}` })
    }
  }
  for (const connection of previous.connections) {
    if (!currentConnections.has(connection.id)) {
      changes.push({ kind: 'connection', summary: `Disconnected ${connectionLabel(previous, connection.id)}` })
    }
  }
  const previousWorkspace = previous.extensions['zoia-editor.workspaceLayout.v1']
  const currentWorkspace = current.extensions['zoia-editor.workspaceLayout.v1']
  if (JSON.stringify(previousWorkspace) !== JSON.stringify(currentWorkspace)) {
    changes.push({ kind: 'workspace', summary: 'Updated workspace layout' })
  }
  return changes.length ? changes : [{ kind: 'patch', summary: 'Updated Patch Document metadata' }]
}

export const loadPatchHistory = createQuery({
  execute: async (seriesId: string): Promise<PatchVersion[]> => {
    const records = await readPatchHistoryRecords(seriesId)
    return records
      .map((record) => {
        try {
          return parsePatchVersion(record)
        } catch {
          return null
        }
      })
      .filter((version): version is PatchVersion => version !== null)
      .sort((left, right) => left.metadata.version - right.metadata.version)
  },
  key: (seriesId: string) => ['patch', 'history', { seriesId }] as const,
})

export const savePatchVersion = createMutation({
  execute: async (version: PatchVersion): Promise<void> => {
    await writePatchHistoryRecord(
      version.metadata.seriesId,
      version.metadata.version,
      version.document,
    )
  },
  key: () => ['patch', 'history', 'save'] as const,
})
