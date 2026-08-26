import { z } from 'zod'

import moduleRegistry from '../../../../shared/module-configurations.v1.json'

import { resolveExperimentalModuleConfiguration } from '#/lib/infra/parser-api'
import { createMutation, createQuery } from '#/lib/utils'

import type { ModuleCatalogEntry } from './patch-draft'

const moduleCatalogParameterSchema = z.object({
  key: z.string(),
  name: z.string(),
  defaultRawValue: z.number().int().min(0).max(65_535),
  unit: z.string().nullable(),
  range: z.array(z.number().nullable()),
})

const moduleCatalogEndpointSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  kind: z.enum(['audioInput', 'audioOutput', 'cvInput', 'cvOutput', 'midi', 'unknown']),
  hardwareBlockIndex: z.number().int().nonnegative().nullable(),
})

const moduleCatalogEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  category: z.string(),
  description: z.string(),
  cpu: z.number(),
  blockCount: z.number().int().positive(),
  role: z.enum(['input', 'output', 'effect']),
  experimental: z.boolean().optional(),
  codec: z
    .object({
      moduleIndex: z.number().int().nonnegative(),
      optionIndices: z.record(z.string(), z.number().int().nonnegative()),
    })
    .optional(),
  options: z
    .array(
      z.object({
        key: z.string(),
        name: z.string(),
        selectedValue: z.union([z.string(), z.number()]),
        values: z.array(z.union([z.string(), z.number()])),
      }),
    )
    .optional(),
  parameters: z.array(moduleCatalogParameterSchema),
  endpoints: z.array(moduleCatalogEndpointSchema),
})

const moduleCatalogPayloadSchema = z.object({
  format: z.literal('zoia-module-configurations'),
  schemaVersion: z.literal(1),
  configurations: z.array(moduleCatalogEntrySchema),
})

const LINEAR_CONFIGURATION_IDS = new Set([
  'vca',
  'filter',
  'compressor',
  'distortion',
  'delay',
  'reverb',
  'mixer',
])

const CONFIGURATION_NAMES: Readonly<Record<string, string>> = {
  'vca': 'VCA · Mono',
  'vca-stereo': 'VCA · Stereo',
  'filter': 'SV Filter · Lowpass',
  'filter-highpass': 'SV Filter · Highpass',
  'compressor': 'Compressor · Mono',
  'compressor-stereo': 'Compressor · Stereo',
  'delay': 'Delay Line · Free',
  'delay-clocked': 'Delay Line · Clocked',
  'reverb': 'Reverb Lite · Mono',
  'reverb-send-stereo': 'Reverb Lite · Mono to Stereo',
  'mixer': 'Audio Mixer · 2× Mono',
  'mixer-stereo': 'Audio Mixer · 2× Stereo',
  'audio-balance-mono': 'Audio Balance · Mono',
  'audio-balance-stereo': 'Audio Balance · Stereo',
}

export type ModuleCatalogGroup = {
  id: string
  name: string
  category: string
  description: string
  variants: { configuration: ModuleCatalogEntry; label: string }[]
}

export function groupModuleCatalog(
  catalog: readonly ModuleCatalogEntry[],
): ModuleCatalogGroup[] {
  const groups = new Map<string, ModuleCatalogGroup>()
  for (const configuration of catalog) {
    const groupId = configuration.type
    const group = groups.get(groupId) ?? {
      id: groupId,
      name: configuration.type,
      category: configuration.category,
      description: configuration.description,
      variants: [],
    }
    const separatorIndex = configuration.name.indexOf(' · ')
    group.variants.push({
      configuration,
      label: separatorIndex >= 0
        ? configuration.name.slice(separatorIndex + 3)
        : 'Add',
    })
    groups.set(groupId, group)
  }
  return [...groups.values()]
}

export function filterModuleCatalog(
  catalog: readonly ModuleCatalogEntry[],
  authoringMode: 'linear' | 'free',
  query: string,
  includeExperimental = true,
): ModuleCatalogEntry[] {
  const normalizedQuery = query.trim().toLowerCase()
  return catalog.filter((configuration) => {
    if (configuration.role !== 'effect') return false
    if (configuration.experimental && !includeExperimental) return false
    if (authoringMode === 'linear' && !LINEAR_CONFIGURATION_IDS.has(configuration.id)) return false
    return !normalizedQuery ||
      `${configuration.name} ${configuration.category} ${configuration.description}`
        .toLowerCase()
        .includes(normalizedQuery)
  })
}

export const resolveExperimentalModuleCatalogEntry = createMutation({
  execute: async (input: {
    moduleIndex: number
    optionIndices: Record<string, number>
  }): Promise<ModuleCatalogEntry> =>
    moduleCatalogEntrySchema.parse(
      await resolveExperimentalModuleConfiguration(input),
    ),
  key: () => ['patch', 'experimental-module-configuration'] as const,
})

export const getModuleCatalog = createQuery({
  execute: async (_options?: { signal?: AbortSignal }): Promise<ModuleCatalogEntry[]> => {
    const result = moduleCatalogPayloadSchema.safeParse(moduleRegistry)
    if (!result.success) throw new Error('The shared Module Configuration Registry is invalid.')
    return result.data.configurations.map((configuration) => ({
      ...configuration,
      name: CONFIGURATION_NAMES[configuration.id] ?? configuration.name,
    }))
  },
  key: () => ['patch', 'module-catalog'] as const,
})
