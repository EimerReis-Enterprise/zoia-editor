import { DEFAULT_ZOIA_MODULE_COLOR_ID } from './patch-colors'
import type { ZoiaModuleColorId } from './patch-colors'
import type { PatchProjection } from './patch'

export type ModuleCatalogParameter = {
  key: string
  name: string
  defaultRawValue: number
  unit: string | null
  range: (number | null)[]
}

export type ModuleCatalogEndpoint = {
  id: string
  key: string
  name: string
  kind:
    'audioInput' | 'audioOutput' | 'cvInput' | 'cvOutput' | 'midi' | 'unknown'
  hardwareBlockIndex: number | null
}

export type ModuleCatalogOption = {
  key: string
  name: string
  selectedValue: string | number
  values: (string | number)[]
}

export type ModuleCatalogEntry = {
  id: string
  name: string
  type: string
  category: string
  description: string
  cpu: number
  blockCount: number
  role?: 'input' | 'output' | 'effect'
  experimental?: boolean
  options?: ModuleCatalogOption[]
  codec?: {
    moduleIndex: number
    optionIndices: Record<string, number>
  }
  parameters: ModuleCatalogParameter[]
  endpoints?: ModuleCatalogEndpoint[]
}

export type PatchDraftModule = {
  id: string
  catalogId: string
  name: string
  colorId: ZoiaModuleColorId
  rawParameters: Record<string, number>
}

export type PatchDraftConnection = {
  id: string
  sourceModuleId: string
  targetModuleId: string
}

export type PatchDraft = {
  version: 1
  name: string
  modules: PatchDraftModule[]
  connections: PatchDraftConnection[]
  nextModuleSequence: number
  nextConnectionSequence: number
}

const INPUT_ID = 'draft-input'
const OUTPUT_ID = 'draft-output'

export function createMonoPatchDraft(name: string): PatchDraft {
  return {
    version: 1,
    name: name.trim(),
    modules: [
      {
        id: INPUT_ID,
        catalogId: 'audio-input-mono',
        name: 'Left Input',
        colorId: DEFAULT_ZOIA_MODULE_COLOR_ID,
        rawParameters: {},
      },
      {
        id: OUTPUT_ID,
        catalogId: 'audio-output-mono',
        name: 'Left Output',
        colorId: DEFAULT_ZOIA_MODULE_COLOR_ID,
        rawParameters: {},
      },
    ],
    connections: [
      {
        id: 'draft-connection-0',
        sourceModuleId: INPUT_ID,
        targetModuleId: OUTPUT_ID,
      },
    ],
    nextModuleSequence: 0,
    nextConnectionSequence: 1,
  }
}

export function insertDraftModule(
  draft: PatchDraft,
  connectionId: string,
  catalogModule: ModuleCatalogEntry,
): PatchDraft {
  const connectionIndex = draft.connections.findIndex(
    (connection) => connection.id === connectionId,
  )
  if (connectionIndex < 0) return draft

  const connection = draft.connections.at(connectionIndex)
  if (!connection) return draft
  const targetIndex = draft.modules.findIndex(
    (module) => module.id === connection.targetModuleId,
  )
  if (targetIndex < 0) return draft

  const moduleId = `draft-module-${draft.nextModuleSequence}`
  const firstConnectionId = `draft-connection-${draft.nextConnectionSequence}`
  const secondConnectionId = `draft-connection-${draft.nextConnectionSequence + 1}`
  const module: PatchDraftModule = {
    id: moduleId,
    catalogId: catalogModule.id,
    name: catalogModule.name,
    colorId: DEFAULT_ZOIA_MODULE_COLOR_ID,
    rawParameters: Object.fromEntries(
      catalogModule.parameters.map((parameter) => [
        parameter.key,
        parameter.defaultRawValue,
      ]),
    ),
  }
  const connections = [...draft.connections]
  connections.splice(
    connectionIndex,
    1,
    {
      id: firstConnectionId,
      sourceModuleId: connection.sourceModuleId,
      targetModuleId: moduleId,
    },
    {
      id: secondConnectionId,
      sourceModuleId: moduleId,
      targetModuleId: connection.targetModuleId,
    },
  )
  const modules = [...draft.modules]
  modules.splice(targetIndex, 0, module)

  return {
    ...draft,
    modules,
    connections,
    nextModuleSequence: draft.nextModuleSequence + 1,
    nextConnectionSequence: draft.nextConnectionSequence + 2,
  }
}

function reorderedDraftModules(
  draft: PatchDraft,
  sourceModuleId: string,
  targetModuleId: string,
): PatchDraftModule[] | null {
  const source = draft.modules.find((module) => module.id === sourceModuleId)
  const target = draft.modules.find((module) => module.id === targetModuleId)
  if (
    !source ||
    !target ||
    source.id === target.id ||
    source.catalogId === 'audio-output-mono' ||
    target.catalogId === 'audio-input-mono' ||
    (source.catalogId === 'audio-input-mono' &&
      target.catalogId === 'audio-output-mono')
  )
    return null

  const moveBeforeOutput = target.catalogId === 'audio-output-mono'
  const movingModule = moveBeforeOutput ? source : target
  const anchorModule = moveBeforeOutput ? target : source
  const modules = draft.modules.filter(
    (module) => module.id !== movingModule.id,
  )
  const anchorIndex = modules.findIndex(
    (module) => module.id === anchorModule.id,
  )
  if (anchorIndex < 0) return null
  modules.splice(anchorIndex + (moveBeforeOutput ? 0 : 1), 0, movingModule)
  return modules
}

export function canReorderDraftModules(
  draft: PatchDraft,
  sourceModuleId: string,
  targetModuleId: string,
): boolean {
  const modules = reorderedDraftModules(draft, sourceModuleId, targetModuleId)
  return Boolean(
    modules &&
    modules.some((module, index) => module.id !== draft.modules[index]?.id),
  )
}

export function reorderDraftModules(
  draft: PatchDraft,
  sourceModuleId: string,
  targetModuleId: string,
): PatchDraft {
  const modules = reorderedDraftModules(draft, sourceModuleId, targetModuleId)
  if (
    !modules ||
    modules.every((module, index) => module.id === draft.modules[index]?.id)
  )
    return draft

  const connections = modules.slice(0, -1).map((module, index) => ({
    id: `draft-connection-${draft.nextConnectionSequence + index}`,
    sourceModuleId: module.id,
    targetModuleId: modules[index + 1].id,
  }))
  return {
    ...draft,
    modules,
    connections,
    nextConnectionSequence: draft.nextConnectionSequence + connections.length,
  }
}

export function removeDraftModule(
  draft: PatchDraft,
  moduleId: string,
): PatchDraft {
  const module = draft.modules.find((candidate) => candidate.id === moduleId)
  if (!module || module.catalogId.startsWith('audio-')) return draft
  const incoming = draft.connections.find(
    (connection) => connection.targetModuleId === moduleId,
  )
  const outgoing = draft.connections.find(
    (connection) => connection.sourceModuleId === moduleId,
  )
  if (!incoming || !outgoing) return draft

  return {
    ...draft,
    modules: draft.modules.filter((candidate) => candidate.id !== moduleId),
    connections: [
      ...draft.connections.filter(
        (connection) =>
          connection.id !== incoming.id && connection.id !== outgoing.id,
      ),
      {
        id: `draft-connection-${draft.nextConnectionSequence}`,
        sourceModuleId: incoming.sourceModuleId,
        targetModuleId: outgoing.targetModuleId,
      },
    ],
    nextConnectionSequence: draft.nextConnectionSequence + 1,
  }
}

export function setDraftModuleColor(
  draft: PatchDraft,
  moduleId: string,
  colorId: ZoiaModuleColorId,
): PatchDraft {
  const moduleIndex = draft.modules.findIndex(
    (module) => module.id === moduleId,
  )
  const module = draft.modules.at(moduleIndex)
  if (!module || module.colorId === colorId) return draft
  const modules = [...draft.modules]
  modules[moduleIndex] = { ...module, colorId }
  return { ...draft, modules }
}

export function setDraftParameter(
  draft: PatchDraft,
  moduleId: string,
  parameterKey: string,
  rawValue: number,
): PatchDraft {
  const moduleIndex = draft.modules.findIndex(
    (module) => module.id === moduleId,
  )
  const module = draft.modules.at(moduleIndex)
  if (!module || module.rawParameters[parameterKey] === rawValue) return draft
  const modules = [...draft.modules]
  modules[moduleIndex] = {
    ...module,
    rawParameters: { ...module.rawParameters, [parameterKey]: rawValue },
  }
  return { ...draft, modules }
}

function interpolateRange(
  rawValue: number,
  range: readonly (number | null)[],
): number | null {
  if (range.length < 2) return null
  const normalized = rawValue / 65_535
  const segments = range.length - 1
  const scaled = Math.min(segments, normalized * segments)
  const index = Math.min(segments - 1, Math.floor(scaled))
  const start = range[index]
  const end = range[index + 1]
  if (start === null || end === null) return null
  return start + (end - start) * (scaled - index)
}

function displayParameterValue(
  rawValue: number,
  parameter: ModuleCatalogParameter,
): string {
  const decoded = interpolateRange(rawValue, parameter.range)
  if (decoded === null) {
    if (rawValue === 0 && parameter.range[0] === null) {
      return `−∞ ${parameter.unit ?? ''}`.trim()
    }
    if (rawValue === 65_535 && parameter.range.at(-1) === null) {
      return `∞ ${parameter.unit ?? ''}`.trim()
    }
    return `${((rawValue / 65_535) * 100).toFixed(1)}% raw range`
  }
  const precision =
    Math.abs(decoded) >= 100 ? 0 : Math.abs(decoded) >= 10 ? 1 : 2
  return `${decoded.toFixed(precision)}${parameter.unit ? ` ${parameter.unit}` : ''}`
}

export function projectPatchDraft(
  draft: PatchDraft,
  catalog: readonly ModuleCatalogEntry[],
): PatchProjection {
  const catalogById = new Map(catalog.map((module) => [module.id, module]))
  const connections = draft.connections.map((connection) => ({
    id: connection.id,
    sourceModuleId: connection.sourceModuleId,
    targetModuleId: connection.targetModuleId,
    sourceEndpoint: 'Audio out',
    targetEndpoint: 'Audio in',
    strength: 100,
  }))
  const incoming = new Map<string, string[]>()
  const outgoing = new Map<string, string[]>()
  for (const connection of connections) {
    incoming.set(connection.targetModuleId, [
      ...(incoming.get(connection.targetModuleId) ?? []),
      connection.id,
    ])
    outgoing.set(connection.sourceModuleId, [
      ...(outgoing.get(connection.sourceModuleId) ?? []),
      connection.id,
    ])
  }

  let page = 0
  let pageBlockCount = 0
  const modules = draft.modules.map((draftModule, moduleId) => {
    const catalogModule = catalogById.get(draftModule.catalogId)
    const isInput = draftModule.catalogId === 'audio-input-mono'
    const blockCount = catalogModule?.blockCount ?? 1
    if (pageBlockCount + blockCount > 40) {
      page += 1
      pageBlockCount = 0
    }
    const modulePage = page
    pageBlockCount += blockCount
    return {
      id: draftModule.id,
      moduleId,
      name: draftModule.name,
      type: catalogModule?.type ?? (isInput ? 'Audio Input' : 'Audio Output'),
      category: catalogModule?.category ?? 'Interface',
      page: modulePage,
      colorId: draftModule.colorId,
      parameters: (catalogModule?.parameters ?? []).map((parameter, index) => {
        const rawValue =
          draftModule.rawParameters[parameter.key] ?? parameter.defaultRawValue
        return {
          id: `parameter-${index}`,
          key: parameter.key,
          kind: 'parameter' as const,
          name: parameter.name,
          displayValue: displayParameterValue(rawValue, parameter),
          rawValue,
          decoded: true,
        }
      }),
      incomingConnectionIds: incoming.get(draftModule.id) ?? [],
      outgoingConnectionIds: outgoing.get(draftModule.id) ?? [],
    }
  })

  return {
    id: 'local-patch-draft',
    name: draft.name,
    sourceFilename: `zoia_${draft.name}.bin`,
    modules,
    connections,
    stats: {
      moduleCount: modules.length,
      audioConnectionCount: connections.length,
      pageCount: page + 1,
    },
  }
}
