import { describe, expect, it } from 'vitest'

import {
  canReorderDraftModules,
  createMonoPatchDraft,
  insertDraftModule,
  projectPatchDraft,
  reorderDraftModules,
  removeDraftModule,
  setDraftParameter,
} from './patch-draft'
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

describe('Patch Draft authoring operations', () => {
  it('creates a prewired mono Signal Chain', () => {
    const draft = createMonoPatchDraft('First Patch')

    expect(draft.modules.map((module) => module.catalogId)).toEqual([
      'audio-input-mono',
      'audio-output-mono',
    ])
    expect(draft.connections).toHaveLength(1)
  })

  it('inserts and removes a Module without breaking the Signal Chain', () => {
    const initial = createMonoPatchDraft('First Patch')
    const inserted = insertDraftModule(initial, initial.connections[0].id, gain)

    expect(inserted.modules.map((module) => module.catalogId)).toEqual([
      'audio-input-mono',
      'vca',
      'audio-output-mono',
    ])
    expect(inserted.connections).toHaveLength(2)

    const removed = removeDraftModule(inserted, inserted.modules[1].id)
    expect(removed.modules).toHaveLength(2)
    expect(removed.connections).toHaveLength(1)
    expect(removed.connections[0]).toMatchObject({
      sourceModuleId: 'draft-input',
      targetModuleId: 'draft-output',
    })
  })

  it('reorders effect Modules while preserving fixed mono endpoints', () => {
    const initial = createMonoPatchDraft('First Patch')
    const first = insertDraftModule(initial, initial.connections[0].id, gain)
    const second = insertDraftModule(first, first.connections[1].id, gain)
    const third = insertDraftModule(second, second.connections[2].id, gain)

    expect(canReorderDraftModules(third, 'draft-module-0', 'draft-module-2')).toBe(true)
    const reordered = reorderDraftModules(
      third,
      'draft-module-0',
      'draft-module-2',
    )

    expect(reordered.modules.map((module) => module.id)).toEqual([
      'draft-input',
      'draft-module-0',
      'draft-module-2',
      'draft-module-1',
      'draft-output',
    ])
    expect(
      reordered.connections.map((connection) => [
        connection.sourceModuleId,
        connection.targetModuleId,
      ]),
    ).toEqual([
      ['draft-input', 'draft-module-0'],
      ['draft-module-0', 'draft-module-2'],
      ['draft-module-2', 'draft-module-1'],
      ['draft-module-1', 'draft-output'],
    ])
    expect(canReorderDraftModules(reordered, 'draft-output', 'draft-module-0')).toBe(false)
    expect(canReorderDraftModules(reordered, 'draft-module-0', 'draft-input')).toBe(false)
  })

  it('projects canonical Raw Parameter Values with musician-facing units', () => {
    const initial = createMonoPatchDraft('First Patch')
    const inserted = insertDraftModule(initial, initial.connections[0].id, gain)
    const edited = setDraftParameter(
      inserted,
      inserted.modules[1].id,
      'level_control',
      65_535,
    )
    const projection = projectPatchDraft(edited, [gain])

    expect(projection.modules[1].parameters[0]).toMatchObject({
      rawValue: 65_535,
      displayValue: '0.00 dB',
    })
  })
})
