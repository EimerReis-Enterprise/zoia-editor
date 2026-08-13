import { describe, expect, it } from 'vitest'

import { setPatchDocumentModuleColor } from './patch-colors'
import { getModuleCatalog } from './patch-catalog'
import { createMonoPatchDraft, insertDraftModule } from './patch-draft'
import {
  addPatchDocumentModule,
  connectPatchDocumentEndpoints,
  createAdvancedPatchDocument,
  createPatchDocumentControlMapping,
  parsePatchDocument,
  removePatchDocumentConnection,
  patchDocumentFromDraft,
  projectPatchDocument,
  reconnectPatchDocumentConnection,
  setPatchDocumentControlMappingRange,
} from './patch-document'
import { serializePatchDocument } from './patch'
import type { ModuleCatalogEntry } from './patch-draft'
import {
  samePatchSemantics,
  setModuleWorkspacePosition,
  setWorkspaceLayout,
  workspaceLayout,
} from './workspace-layout'

const gain: ModuleCatalogEntry = {
  id: 'vca',
  name: 'VCA',
  type: 'VCA',
  category: 'Audio',
  description: 'Gain stage',
  cpu: 0.3,
  blockCount: 3,
  parameters: [
    {
      key: 'level_control',
      name: 'Level Control',
      defaultRawValue: 0,
      unit: 'dB',
      range: [null, -12, -6, -2.5, 0],
    },
  ],
}

describe('Patch Document', () => {
  it('is the canonical JSON representation for authored patches', () => {
    const initial = createMonoPatchDraft('JSON Patch')
    const draft = insertDraftModule(initial, initial.connections[0].id, gain)
    const document = patchDocumentFromDraft(draft, [gain])
    const restored = parsePatchDocument(
      JSON.parse(serializePatchDocument(document)),
    )

    expect(restored.format).toBe('zoia-patch')
    expect(restored.schemaVersion).toBe(1)
    expect(restored.modules.map((module) => module.configurationId)).toEqual([
      'audio-input-mono',
      'vca',
      'audio-output-mono',
    ])
    expect(projectPatchDocument(restored).connections).toHaveLength(2)
  })

  it('accepts an imported option sharing a hardware parameter key', async () => {
    const document = createAdvancedPatchDocument(
      'Imported',
      await getModuleCatalog(),
    )
    const option = document.modules[0].parameters.find(
      (parameter) => parameter.kind === 'option',
    )!
    const imported = {
      ...document,
      modules: [
        {
          ...document.modules[0],
          parameters: [
            ...document.modules[0].parameters,
            {
              ...option,
              id: 'parameter-shared-key',
              kind: 'parameter' as const,
              rawValue: 0,
            },
          ],
        },
        ...document.modules.slice(1),
      ],
    }

    expect(parsePatchDocument(imported)).toEqual(imported)
  })

  it('stores and projects the 15 hardware Module colors', () => {
    const document = patchDocumentFromDraft(createMonoPatchDraft('Colors'), [])
    const colored = setPatchDocumentModuleColor(document, 'draft-input', 13)

    expect(colored.colors[0]).toBe(13)
    expect(projectPatchDocument(colored).modules[0].colorId).toBe(13)
  })

  it('creates one managed CV Connection per mapped target parameter', async () => {
    const catalog = await getModuleCatalog()
    const button = catalog.find(
      (configuration) => configuration.id === 'ui-button-momentary',
    )!
    const vca = catalog.find((configuration) => configuration.id === 'vca')!
    let document = addPatchDocumentModule(
      createAdvancedPatchDocument('Mapped', catalog),
      button,
    )
    document = addPatchDocumentModule(document, vca)

    const mapped = createPatchDocumentControlMapping(document, {
      sourceModuleId: 'module-0',
      sourceEndpointId: 'cv_output',
      targetModuleId: 'module-1',
      targetEndpointId: 'level_control',
      minimumRaw: 10_000,
      maximumRaw: 40_000,
    })

    expect(mapped.connections.at(-1)).toMatchObject({
      kind: 'cv',
      strengthRaw: 4_578,
      sourceModuleId: 'module-0',
      targetModuleId: 'module-1',
    })
    expect(mapped.modules[3].parameters[0].rawValue).toBe(10_000)
    expect(
      createPatchDocumentControlMapping(mapped, {
        sourceModuleId: 'module-0',
        sourceEndpointId: 'cv_output',
        targetModuleId: 'module-1',
        targetEndpointId: 'level_control',
        minimumRaw: 0,
        maximumRaw: 20_000,
      }),
    ).toBe(mapped)

    const adjusted = setPatchDocumentControlMappingRange(
      mapped,
      mapped.connections.at(-1)!.id,
      20_000,
      50_000,
    )
    expect(adjusted.connections.at(-1)?.strengthRaw).toBe(4_578)
    expect(adjusted.modules[3].parameters[0].rawValue).toBe(20_000)
    const unmapped = removePatchDocumentConnection(
      adjusted,
      adjusted.connections.at(-1)!.id,
    )
    expect(
      unmapped.connections.some((connection) => connection.kind === 'cv'),
    ).toBe(false)
    expect(unmapped.modules[3].parameters[0].rawValue).toBe(20_000)
  })

  it('authors endpoint-aware free routing with shared configurations', async () => {
    const catalog = await getModuleCatalog()
    const looper = catalog.find(
      (configuration) => configuration.id === 'looper-8s-once',
    )!
    const initial = createAdvancedPatchDocument('Performance', catalog)
    const withLooper = addPatchDocumentModule(initial, looper)
    const connected = connectPatchDocumentEndpoints(
      withLooper,
      'input',
      'output_L',
      'module-0',
      'audio_in',
    )

    expect(connected.authoringMode).toBe('free')
    expect(connected.modules.at(-1)?.configurationId).toBe('looper-8s-once')
    expect(connected.connections.at(-1)).toMatchObject({
      sourceEndpointId: 'output_L',
      targetEndpointId: 'audio_in',
      kind: 'audio',
    })
  })

  it('reconnects one endpoint atomically while preserving Connection identity', async () => {
    const catalog = await getModuleCatalog()
    const document = createAdvancedPatchDocument('Reconnect', catalog)
    const source = document.modules[0]
    const target = document.modules[1]
    const sourceEndpoint = source.endpoints.find(
      (endpoint) => endpoint.kind === 'audioOutput',
    )!
    const targetEndpoints = target.endpoints.filter(
      (endpoint) => endpoint.kind === 'audioInput',
    )
    const connected = connectPatchDocumentEndpoints(
      document,
      source.id,
      sourceEndpoint.id,
      target.id,
      targetEndpoints[0].id,
    )
    const connection = connected.connections.at(-1)!
    const reconnected = reconnectPatchDocumentConnection(
      connected,
      connection.id,
      source.id,
      sourceEndpoint.id,
      target.id,
      targetEndpoints.at(-1)!.id,
    )

    expect(reconnected.connections.at(-1)).toMatchObject({
      id: connection.id,
      strengthRaw: connection.strengthRaw,
      targetEndpointId: targetEndpoints.at(-1)!.id,
    })
  })

  it('persists Workspace Layout without changing Patch semantics', () => {
    const document = patchDocumentFromDraft(
      createMonoPatchDraft('Workspace'),
      [],
    )
    const positioned = setModuleWorkspacePosition(document, 'draft-input', {
      x: -120.5,
      y: 84,
    })
    const reset = setWorkspaceLayout(positioned, {
      'draft-input': { x: 10, y: 20 },
      missing: { x: 99, y: 99 },
    })

    expect(workspaceLayout(positioned)['draft-input']).toEqual({
      x: -120.5,
      y: 84,
    })
    expect(workspaceLayout(reset)).toEqual({
      'draft-input': { x: 10, y: 20 },
    })
    expect(samePatchSemantics(document, positioned)).toBe(true)
  })

  it('rejects dangling logical references', () => {
    const document = patchDocumentFromDraft(createMonoPatchDraft('Broken'), [])
    document.connections[0].targetModuleId = 'missing'

    expect(() => parsePatchDocument(document)).toThrow(/unknown Module/)
  })
})
