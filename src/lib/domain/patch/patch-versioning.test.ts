import { describe, expect, it } from 'vitest'

import { getModuleCatalog } from './patch-catalog'
import { createAdvancedPatchDocument } from './patch-document'
import { createPatchVersion, describePatchChanges, patchVersionMetadata, samePatchVersionContent, versionedPatchFilename } from './patch-versioning'

describe('Patch Versioning', () => {
  it('assigns sequential portable metadata and filenames', async () => {
    const document = createAdvancedPatchDocument('Wash Out', await getModuleCatalog())
    const first = createPatchVersion(document, [], 'Initial wash', '2025-01-01T00:00:00.000Z')
    const second = createPatchVersion(first.document, [first], 'More decay', '2025-01-02T00:00:00.000Z')
    expect(patchVersionMetadata(second.document)?.version).toBe(2)
    expect(second.metadata.seriesId).toBe(first.metadata.seriesId)
    expect(versionedPatchFilename(document.name, 2)).toBe('Wash Out.v002.zoia.json')
    expect(samePatchVersionContent(first.document, second.document)).toBe(true)
  })

  it('describes musician-facing module changes', async () => {
    const previous = createAdvancedPatchDocument('Wash Out', await getModuleCatalog())
    const current = { ...previous, modules: previous.modules.slice(0, 1) }
    expect(describePatchChanges(previous, current)).toEqual([
      { kind: 'module', summary: 'Removed Stereo Output' },
    ])
  })
})
