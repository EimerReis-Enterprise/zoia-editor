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
  setPatchDocumentControlMappingRange,
} from './patch-document'
import { serializePatchDocument } from './patch'
import type { ModuleCatalogEntry } from './patch-draft'

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
      strengthRaw: 30_000,
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
    expect(adjusted.connections.at(-1)?.strengthRaw).toBe(30_000)
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

  it('rejects dangling logical references', () => {
    const document = patchDocumentFromDraft(createMonoPatchDraft('Broken'), [])
    document.connections[0].targetModuleId = 'missing'

    expect(() => parsePatchDocument(document)).toThrow(/unknown Module/)
  })
})
