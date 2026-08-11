import { z } from 'zod'

import { patchDocumentModuleColorId } from './patch-colors'
import { projectPatchDraft } from './patch-draft'
import type { ModuleCatalogEntry, PatchDraft } from './patch-draft'
import type { ParameterEdit } from './patch-editing'
import type { PatchProjection } from './patch'

export const PATCH_DOCUMENT_FORMAT = 'zoia-patch' as const
export const PATCH_DOCUMENT_SCHEMA_VERSION = 1 as const

const rawValueSchema = z.union([z.string(), z.number(), z.null()])

const patchDocumentParameterSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  kind: z.enum(['parameter', 'option']),
  name: z.string(),
  rawValue: rawValueSchema,
  displayValue: z.string(),
  decoded: z.boolean(),
  unit: z.string().nullable().optional(),
  range: z.array(z.number().nullable()).optional(),
})

const patchDocumentModuleSchema = z.object({
  id: z.string().min(1),
  configurationId: z.string().nullable(),
  name: z.string(),
  type: z.string(),
  category: z.string(),
  parameters: z.array(patchDocumentParameterSchema),
  endpoints: z.array(
    z.object({
      id: z.string().min(1),
      key: z.string().min(1),
      name: z.string(),
      kind: z.enum([
        'audioInput',
        'audioOutput',
        'cvInput',
        'cvOutput',
        'midi',
        'unknown',
      ]),
      hardwareBlockIndex: z.number().int().nonnegative().nullable(),
    }),
  ),
  hardware: z
    .object({
      moduleIndex: z.number().int().nonnegative(),
      moduleTypeIndex: z.number().int().nonnegative().nullable(),
      version: z.number().int().nonnegative().nullable(),
      page: z.number().int().nonnegative().nullable(),
      headerColorId: z.number().int().nullable(),
      position: z.array(z.number().int().nonnegative()),
    })
    .nullable(),
  opaque: z.unknown().optional(),
})

const patchDocumentConnectionSchema = z.object({
  id: z.string().min(1),
  sourceModuleId: z.string().min(1),
  targetModuleId: z.string().min(1),
  sourceEndpointId: z.string().min(1),
  targetEndpointId: z.string().min(1),
  sourceEndpoint: z.string(),
  targetEndpoint: z.string(),
  kind: z.enum(['audio', 'cv', 'midi', 'unknown']),
  strengthRaw: z.number().int().min(0).max(65_535),
})

const binarySourceSchema = z.object({
  kind: z.literal('binary'),
  filename: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  binaryBase64: z.string().min(1),
  codec: z.object({ name: z.string(), revision: z.string() }),
})

export const patchDocumentSchema = z
  .object({
    format: z.literal(PATCH_DOCUMENT_FORMAT),
    schemaVersion: z.literal(PATCH_DOCUMENT_SCHEMA_VERSION),
    documentId: z.string().min(1),
    name: z.string(),
    authoringMode: z.enum(['linear', 'free', 'preserved']),
    modules: z.array(patchDocumentModuleSchema).min(1),
    connections: z.array(patchDocumentConnectionSchema),
    pages: z.array(z.unknown()),
    starred: z.array(z.unknown()),
    colors: z.array(z.unknown()),
    source: binarySourceSchema.nullable(),
    opaque: z.record(z.string(), z.unknown()).default({}),
    sequences: z.object({
      nextModule: z.number().int().nonnegative(),
      nextConnection: z.number().int().nonnegative(),
    }),
    annotations: z.record(z.string(), z.string()).optional(),
    extensions: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((document, context) => {
    const moduleIds = new Set<string>()
    for (const module of document.modules) {
      if (moduleIds.has(module.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate Module ID: ${module.id}`,
        })
      }
      moduleIds.add(module.id)
      const parameterKeys = new Set<string>()
      for (const parameter of module.parameters) {
        if (parameterKeys.has(parameter.key)) {
          context.addIssue({
            code: 'custom',
            message: `Duplicate parameter ${parameter.key} on ${module.id}`,
          })
        }
        parameterKeys.add(parameter.key)
        if (
          parameter.kind === 'parameter' &&
          typeof parameter.rawValue === 'number' &&
          (!Number.isInteger(parameter.rawValue) ||
            parameter.rawValue < 0 ||
            parameter.rawValue > 65_535)
        ) {
          context.addIssue({
            code: 'custom',
            message: `Raw Parameter Value is out of range on ${module.id}.${parameter.key}`,
          })
        }
      }
    }
    const connectionIds = new Set<string>()
    for (const connection of document.connections) {
      if (connectionIds.has(connection.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate Connection ID: ${connection.id}`,
        })
      }
      connectionIds.add(connection.id)
      if (
        !moduleIds.has(connection.sourceModuleId) ||
        !moduleIds.has(connection.targetModuleId)
      ) {
        context.addIssue({
          code: 'custom',
          message: `Connection ${connection.id} references an unknown Module`,
        })
      }
    }
  })

export type PatchDocument = z.infer<typeof patchDocumentSchema>
export type PatchDocumentModule = z.infer<typeof patchDocumentModuleSchema>
export type PatchDocumentConnection = z.infer<
  typeof patchDocumentConnectionSchema
>

export type ControlMappingInput = {
  sourceModuleId: string
  sourceEndpointId: string
  targetModuleId: string
  targetEndpointId: string
  minimumRaw: number
  maximumRaw: number
}

export function parsePatchDocument(value: unknown): PatchDocument {
  const result = patchDocumentSchema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues.at(0)
    throw new Error(
      issue?.message ?? 'The JSON file is not a valid ZOIA Patch Document.',
    )
  }
  return result.data
}

export function projectPatchDocument(document: PatchDocument): PatchProjection {
  const incoming = new Map<string, string[]>()
  const outgoing = new Map<string, string[]>()
  const endpointKinds = new Map(
    document.modules.flatMap((module) =>
      module.endpoints.map(
        (endpoint) => [`${module.id}:${endpoint.id}`, endpoint.kind] as const,
      ),
    ),
  )
  const connections = document.connections
    .filter(
      (connection) =>
        document.authoringMode === 'free' ||
        (connection.kind === 'audio' &&
          endpointKinds.get(
            `${connection.sourceModuleId}:${connection.sourceEndpointId}`,
          ) === 'audioOutput' &&
          endpointKinds.get(
            `${connection.targetModuleId}:${connection.targetEndpointId}`,
          ) === 'audioInput'),
    )
    .map((connection) => {
      incoming.set(connection.targetModuleId, [
        ...(incoming.get(connection.targetModuleId) ?? []),
        connection.id,
      ])
      outgoing.set(connection.sourceModuleId, [
        ...(outgoing.get(connection.sourceModuleId) ?? []),
        connection.id,
      ])
      return {
        id: connection.id,
        sourceModuleId: connection.sourceModuleId,
        targetModuleId: connection.targetModuleId,
        sourceEndpoint: connection.sourceEndpoint,
        targetEndpoint: connection.targetEndpoint,
        strength: Math.round(connection.strengthRaw / 100),
        kind: connection.kind,
      }
    })
  const modules = document.modules.map((module, index) => ({
    id: module.id,
    moduleId: module.hardware?.moduleIndex ?? index,
    name: module.name,
    type: module.type,
    category: module.category,
    page: module.hardware?.page ?? 0,
    colorId: patchDocumentModuleColorId(document, module.id),
    parameters: module.parameters.map(
      ({ unit: _unit, range: _range, ...parameter }) => parameter,
    ),
    incomingConnectionIds: incoming.get(module.id) ?? [],
    outgoingConnectionIds: outgoing.get(module.id) ?? [],
  }))
  return {
    id: document.documentId,
    name: document.name,
    sourceFilename: document.source?.filename ?? `${document.name}.zoia.json`,
    modules,
    connections,
    stats: {
      moduleCount: modules.length,
      audioConnectionCount: connections.length,
      pageCount: Math.max(1, document.pages.length),
    },
  }
}

function moduleFromConfiguration(
  id: string,
  configuration: ModuleCatalogEntry,
  name = configuration.type.replace(/[^ -~]/g, ' ').slice(0, 16),
): PatchDocumentModule {
  return {
    id,
    configurationId: configuration.id,
    name,
    type: configuration.type,
    category: configuration.category,
    parameters: [
      ...configuration.parameters.map(createCatalogParameter),
      ...(configuration.options ?? []).map((option, index) => ({
        id: `option-${index}`,
        key: option.key,
        kind: 'option' as const,
        name: option.name,
        rawValue: option.selectedValue,
        displayValue: `${option.selectedValue} · choices: ${option.values.join(', ')}`,
        decoded: true,
        unit: null,
        range: [],
      })),
    ],
    endpoints:
      configuration.endpoints?.map((endpoint) => ({ ...endpoint })) ?? [],
    hardware: null,
  }
}

export function createAdvancedPatchDocument(
  name: string,
  catalog: readonly ModuleCatalogEntry[],
): PatchDocument {
  const inputConfiguration = catalog.find(
    (configuration) => configuration.id === 'audio-input-stereo',
  )
  const outputConfiguration = catalog.find(
    (configuration) => configuration.id === 'audio-output-stereo',
  )
  if (!inputConfiguration || !outputConfiguration) {
    throw new Error(
      'The stereo I/O configurations are missing from the Module Configuration Registry.',
    )
  }
  const input = moduleFromConfiguration(
    'input',
    inputConfiguration,
    'Stereo Input',
  )
  const output = moduleFromConfiguration(
    'output',
    outputConfiguration,
    'Stereo Output',
  )
  const inputOutputs = input.endpoints.filter(
    (endpoint) => endpoint.kind === 'audioOutput',
  )
  const outputInputs = output.endpoints.filter(
    (endpoint) => endpoint.kind === 'audioInput',
  )
  const connections: PatchDocumentConnection[] = inputOutputs
    .slice(0, 2)
    .map((endpoint, index) => ({
      id: `connection-${index}`,
      sourceModuleId: input.id,
      targetModuleId: output.id,
      sourceEndpointId: endpoint.id,
      targetEndpointId:
        outputInputs.at(index)?.id ?? outputInputs.at(0)?.id ?? 'input_L',
      sourceEndpoint: endpoint.name,
      targetEndpoint:
        outputInputs.at(index)?.name ?? outputInputs.at(0)?.name ?? 'Input',
      kind: 'audio',
      strengthRaw: 10_000,
    }))
  return {
    format: PATCH_DOCUMENT_FORMAT,
    schemaVersion: PATCH_DOCUMENT_SCHEMA_VERSION,
    documentId: 'local-advanced-patch',
    name: name.trim(),
    authoringMode: 'free',
    modules: [input, output],
    connections,
    pages: [],
    starred: [],
    colors: [],
    source: null,
    opaque: {},
    sequences: { nextModule: 0, nextConnection: connections.length },
    extensions: {},
  }
}

export function addPatchDocumentModule(
  document: PatchDocument,
  configuration: ModuleCatalogEntry,
): PatchDocument {
  const id = `module-${document.sequences.nextModule}`
  return {
    ...document,
    modules: [...document.modules, moduleFromConfiguration(id, configuration)],
    sequences: {
      ...document.sequences,
      nextModule: document.sequences.nextModule + 1,
    },
  }
}

export function setPatchDocumentModuleConfiguration(
  document: PatchDocument,
  moduleId: string,
  configuration: ModuleCatalogEntry,
): PatchDocument {
  const current = document.modules.find((module) => module.id === moduleId)
  if (!current || !configuration.codec) return document
  const replacement = moduleFromConfiguration(moduleId, configuration, current.name)
  const currentRawValues = new Map(
    current.parameters
      .filter(
        (parameter) =>
          parameter.kind === 'parameter' &&
          typeof parameter.rawValue === 'number',
      )
      .map((parameter) => [parameter.key, parameter.rawValue] as const),
  )
  replacement.parameters = replacement.parameters.map((parameter) =>
    parameter.kind === 'parameter' && currentRawValues.has(parameter.key)
      ? { ...parameter, rawValue: currentRawValues.get(parameter.key)! }
      : parameter,
  )
  replacement.opaque = {
    ...(typeof current.opaque === 'object' && current.opaque
      ? current.opaque
      : {}),
    experimentalCodec: configuration.codec,
    experimentalConfiguration: configuration,
  }
  const endpointIds = new Set(replacement.endpoints.map((endpoint) => endpoint.id))
  return {
    ...document,
    modules: document.modules.map((module) =>
      module.id === moduleId ? replacement : module,
    ),
    connections: document.connections.filter(
      (connection) =>
        (connection.sourceModuleId !== moduleId ||
          endpointIds.has(connection.sourceEndpointId)) &&
        (connection.targetModuleId !== moduleId ||
          endpointIds.has(connection.targetEndpointId)),
    ),
  }
}

export function connectPatchDocumentEndpoints(
  document: PatchDocument,
  sourceModuleId: string,
  sourceEndpointId: string,
  targetModuleId: string,
  targetEndpointId: string,
): PatchDocument {
  const sourceModule = document.modules.find(
    (module) => module.id === sourceModuleId,
  )
  const targetModule = document.modules.find(
    (module) => module.id === targetModuleId,
  )
  const source = sourceModule?.endpoints.find(
    (endpoint) => endpoint.id === sourceEndpointId,
  )
  const target = targetModule?.endpoints.find(
    (endpoint) => endpoint.id === targetEndpointId,
  )
  if (
    !sourceModule ||
    !targetModule ||
    !source ||
    !target ||
    sourceModule.id === targetModule.id
  )
    return document
  const kind =
    source.kind === 'audioOutput' && target.kind === 'audioInput'
      ? 'audio'
      : source.kind === 'cvOutput' && target.kind === 'cvInput'
        ? 'cv'
        : null
  if (!kind) return document
  if (
    document.connections.some(
      (connection) =>
        (connection.sourceModuleId === sourceModuleId &&
          connection.sourceEndpointId === sourceEndpointId &&
          connection.targetModuleId === targetModuleId &&
          connection.targetEndpointId === targetEndpointId) ||
        (kind === 'cv' &&
          connection.kind === 'cv' &&
          connection.targetModuleId === targetModuleId &&
          connection.targetEndpointId === targetEndpointId),
    )
  )
    return document
  const connection: PatchDocumentConnection = {
    id: `connection-${document.sequences.nextConnection}`,
    sourceModuleId,
    targetModuleId,
    sourceEndpointId,
    targetEndpointId,
    sourceEndpoint: source.name,
    targetEndpoint: target.name,
    kind,
    strengthRaw: 10_000,
  }
  return {
    ...document,
    connections: [...document.connections, connection],
    sequences: {
      ...document.sequences,
      nextConnection: document.sequences.nextConnection + 1,
    },
  }
}

function setModuleParameterRawValue(
  module: PatchDocumentModule,
  parameterKey: string,
  rawValue: number,
): PatchDocumentModule | null {
  const parameter = module.parameters.find(
    (candidate) =>
      candidate.key === parameterKey && candidate.kind === 'parameter',
  )
  if (!parameter) return null
  return {
    ...module,
    parameters: module.parameters.map((candidate) =>
      candidate === parameter
        ? {
            ...candidate,
            rawValue,
            displayValue: `${((rawValue / 65_535) * 100).toFixed(1)}% raw range`,
          }
        : candidate,
    ),
  }
}

function validControlMappingRange(
  minimumRaw: number,
  maximumRaw: number,
): boolean {
  return (
    Number.isInteger(minimumRaw) &&
    Number.isInteger(maximumRaw) &&
    minimumRaw >= 0 &&
    maximumRaw <= 65_535 &&
    minimumRaw <= maximumRaw
  )
}

export function createPatchDocumentControlMapping(
  document: PatchDocument,
  mapping: ControlMappingInput,
): PatchDocument {
  if (
    document.authoringMode !== 'free' ||
    !validControlMappingRange(mapping.minimumRaw, mapping.maximumRaw)
  )
    return document
  const sourceModule = document.modules.find(
    (module) => module.id === mapping.sourceModuleId,
  )
  const targetModule = document.modules.find(
    (module) => module.id === mapping.targetModuleId,
  )
  const source = sourceModule?.endpoints.find(
    (endpoint) => endpoint.id === mapping.sourceEndpointId,
  )
  const target = targetModule?.endpoints.find(
    (endpoint) => endpoint.id === mapping.targetEndpointId,
  )
  if (
    !sourceModule ||
    !targetModule ||
    !source ||
    !target ||
    source.kind !== 'cvOutput' ||
    target.kind !== 'cvInput'
  )
    return document
  if (
    document.connections.some(
      (connection) =>
        connection.kind === 'cv' &&
        connection.targetModuleId === targetModule.id &&
        connection.targetEndpointId === target.id,
    )
  )
    return document
  const updatedTarget = setModuleParameterRawValue(
    targetModule,
    target.key,
    mapping.minimumRaw,
  )
  if (!updatedTarget) return document
  return {
    ...document,
    modules: document.modules.map((module) =>
      module.id === targetModule.id ? updatedTarget : module,
    ),
    connections: [
      ...document.connections,
      {
        id: `connection-${document.sequences.nextConnection}`,
        sourceModuleId: sourceModule.id,
        targetModuleId: targetModule.id,
        sourceEndpointId: source.id,
        targetEndpointId: target.id,
        sourceEndpoint: source.name,
        targetEndpoint: target.name,
        kind: 'cv',
        strengthRaw: mapping.maximumRaw - mapping.minimumRaw,
      },
    ],
    sequences: {
      ...document.sequences,
      nextConnection: document.sequences.nextConnection + 1,
    },
  }
}

export function setPatchDocumentControlMappingRange(
  document: PatchDocument,
  connectionId: string,
  minimumRaw: number,
  maximumRaw: number,
): PatchDocument {
  if (!validControlMappingRange(minimumRaw, maximumRaw)) return document
  const connection = document.connections.find(
    (candidate) => candidate.id === connectionId && candidate.kind === 'cv',
  )
  if (!connection) return document
  const targetModule = document.modules.find(
    (module) => module.id === connection.targetModuleId,
  )
  const target = targetModule?.endpoints.find(
    (endpoint) => endpoint.id === connection.targetEndpointId,
  )
  if (!targetModule || !target || target.kind !== 'cvInput') return document
  const updatedTarget = setModuleParameterRawValue(
    targetModule,
    target.key,
    minimumRaw,
  )
  if (!updatedTarget) return document
  return {
    ...document,
    modules: document.modules.map((module) =>
      module.id === targetModule.id ? updatedTarget : module,
    ),
    connections: document.connections.map((candidate) =>
      candidate.id === connection.id
        ? { ...candidate, strengthRaw: maximumRaw - minimumRaw }
        : candidate,
    ),
  }
}

export function renamePatchDocumentModule(
  document: PatchDocument,
  moduleId: string,
  name: string,
): PatchDocument {
  const normalized = name.trim().slice(0, 16)
  if (!normalized) return document
  const module = document.modules.find((candidate) => candidate.id === moduleId)
  if (!module || module.name === normalized) return document
  return {
    ...document,
    modules: document.modules.map((candidate) =>
      candidate.id === moduleId
        ? { ...candidate, name: normalized }
        : candidate,
    ),
  }
}

export function removePatchDocumentConnection(
  document: PatchDocument,
  connectionId: string,
): PatchDocument {
  if (
    !document.connections.some((connection) => connection.id === connectionId)
  )
    return document
  return {
    ...document,
    connections: document.connections.filter(
      (connection) => connection.id !== connectionId,
    ),
  }
}

export function removePatchDocumentModule(
  document: PatchDocument,
  moduleId: string,
): PatchDocument {
  const module = document.modules.find((candidate) => candidate.id === moduleId)
  if (
    !module ||
    module.configurationId?.startsWith('audio-input') ||
    module.configurationId?.startsWith('audio-output')
  )
    return document
  return {
    ...document,
    modules: document.modules.filter((candidate) => candidate.id !== moduleId),
    connections: document.connections.filter(
      (connection) =>
        connection.sourceModuleId !== moduleId &&
        connection.targetModuleId !== moduleId,
    ),
  }
}

export function parameterRawValues(
  module: PatchDocumentModule,
): Record<string, number> {
  return Object.fromEntries(
    module.parameters
      .filter(
        (parameter) =>
          parameter.kind === 'parameter' &&
          typeof parameter.rawValue === 'number',
      )
      .map((parameter) => [parameter.key, parameter.rawValue as number]),
  )
}

export function patchDocumentFromDraft(
  draft: PatchDraft,
  catalog: readonly ModuleCatalogEntry[],
  previousDocument?: PatchDocument,
): PatchDocument {
  const projection = projectPatchDraft(draft, catalog)
  const projectionById = new Map(
    projection.modules.map((module) => [module.id, module]),
  )
  const catalogById = new Map(
    catalog.map((configuration) => [configuration.id, configuration]),
  )
  return {
    format: PATCH_DOCUMENT_FORMAT,
    schemaVersion: PATCH_DOCUMENT_SCHEMA_VERSION,
    documentId: previousDocument?.documentId ?? 'local-patch-document',
    name: draft.name,
    authoringMode: 'linear',
    modules: draft.modules.map((module) => {
      const projected = projectionById.get(module.id)
      return {
        id: module.id,
        configurationId: module.catalogId,
        name: module.name,
        type: projected?.type ?? 'Unknown module',
        category: projected?.category ?? 'Unknown',
        parameters: (projected?.parameters ?? []).map((parameter) => ({
          ...parameter,
        })),
        endpoints: catalogById
          .get(module.catalogId)
          ?.endpoints?.map((endpoint) => ({ ...endpoint })) ?? [
          {
            id: 'audio-in-0',
            key: 'audio_in',
            name: 'Audio in',
            kind: 'audioInput' as const,
            hardwareBlockIndex: null,
          },
          {
            id: 'audio-out-0',
            key: 'audio_out',
            name: 'Audio out',
            kind: 'audioOutput' as const,
            hardwareBlockIndex: null,
          },
        ],
        hardware: null,
      }
    }),
    connections: draft.connections.map((connection) => ({
      ...connection,
      sourceEndpointId:
        catalogById
          .get(
            draft.modules.find(
              (module) => module.id === connection.sourceModuleId,
            )?.catalogId ?? '',
          )
          ?.endpoints?.find((endpoint) => endpoint.kind === 'audioOutput')
          ?.id ?? 'audio-out-0',
      targetEndpointId:
        catalogById
          .get(
            draft.modules.find(
              (module) => module.id === connection.targetModuleId,
            )?.catalogId ?? '',
          )
          ?.endpoints?.find((endpoint) => endpoint.kind === 'audioInput')?.id ??
        'audio-in-0',
      sourceEndpoint: 'Audio out',
      targetEndpoint: 'Audio in',
      kind: 'audio' as const,
      strengthRaw: 10_000,
    })),
    pages: previousDocument?.pages ?? [],
    starred: previousDocument?.starred ?? [],
    colors: draft.modules.map((module) => module.colorId),
    source: previousDocument?.source ?? null,
    opaque: previousDocument?.opaque ?? {},
    sequences: {
      nextModule: draft.nextModuleSequence,
      nextConnection: draft.nextConnectionSequence,
    },
    annotations: previousDocument?.annotations,
    extensions: previousDocument?.extensions ?? {},
  }
}

export function patchDocumentToDraft(
  document: PatchDocument,
): PatchDraft | null {
  if (document.authoringMode !== 'linear') return null
  return {
    version: 1,
    name: document.name,
    modules: document.modules.map((module) => ({
      id: module.id,
      catalogId: module.configurationId ?? '',
      name: module.name,
      colorId: patchDocumentModuleColorId(document, module.id),
      rawParameters: parameterRawValues(module),
    })),
    connections: document.connections
      .filter((connection) => connection.kind === 'audio')
      .map((connection) => ({
        id: connection.id,
        sourceModuleId: connection.sourceModuleId,
        targetModuleId: connection.targetModuleId,
      })),
    nextModuleSequence: document.sequences.nextModule,
    nextConnectionSequence: document.sequences.nextConnection,
  }
}

export function applyParameterEditsToDocument(
  document: PatchDocument,
  edits: readonly ParameterEdit[],
): PatchDocument {
  const editsByModule = new Map<number, Map<string, number>>()
  for (const edit of edits) {
    const moduleEdits =
      editsByModule.get(edit.moduleId) ?? new Map<string, number>()
    moduleEdits.set(edit.parameterName, edit.rawValue)
    editsByModule.set(edit.moduleId, moduleEdits)
  }
  return {
    ...document,
    modules: document.modules.map((module, index) => {
      const moduleEdits = editsByModule.get(
        module.hardware?.moduleIndex ?? index,
      )
      if (!moduleEdits) return module
      return {
        ...module,
        parameters: module.parameters.map((parameter) => {
          const rawValue = moduleEdits.get(parameter.key)
          return rawValue === undefined
            ? parameter
            : {
                ...parameter,
                rawValue,
                displayValue: `${((rawValue / 65_535) * 100).toFixed(1)}% raw range`,
              }
        }),
      }
    }),
  }
}

export function createCatalogParameter(
  parameter: ModuleCatalogEntry['parameters'][number],
  index: number,
) {
  return {
    id: `parameter-${index}`,
    key: parameter.key,
    kind: 'parameter' as const,
    name: parameter.name,
    rawValue: parameter.defaultRawValue,
    displayValue: `${((parameter.defaultRawValue / 65_535) * 100).toFixed(1)}% raw range`,
    decoded: true,
    unit: parameter.unit,
    range: parameter.range,
  }
}
