import { beforeEach, describe, expect, it } from 'vitest'

import {
  createMonoPatchDraft,
  getModuleCatalog,
  insertDraftModule,
  patchDocumentFromDraft,
  workspaceLayout,
} from '#/lib/domain/patch'

import { demoPatch } from './demo-patch'
import { useWorkbenchStore } from './workbench-store'

const initialState = useWorkbenchStore.getInitialState()

const gainModule = {
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

describe('Parameter Edit history', () => {
  beforeEach(() => useWorkbenchStore.setState(initialState, true))

  it('undoes and redoes one coalesced parameter gesture', () => {
    const store = useWorkbenchStore.getState()
    store.setPatch(demoPatch, new File([], 'demo.bin'))
    useWorkbenchStore.getState().beginParameterGesture()
    useWorkbenchStore.getState().updateParameter(1, 'threshold', 40_000, 32_767)
    useWorkbenchStore.getState().updateParameter(1, 'threshold', 42_000, 32_767)
    useWorkbenchStore.getState().commitParameterGesture()

    expect(useWorkbenchStore.getState().parameterEdits).toEqual([
      { moduleId: 1, parameterName: 'threshold', rawValue: 42_000 },
    ])
    expect(useWorkbenchStore.getState().pastEdits).toHaveLength(1)

    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().parameterEdits).toEqual([])

    useWorkbenchStore.getState().redo()
    expect(useWorkbenchStore.getState().parameterEdits).toEqual([
      { moduleId: 1, parameterName: 'threshold', rawValue: 42_000 },
    ])
  })

  it('stores imported Parameter Edits in the canonical Patch Document', () => {
    const draft = insertDraftModule(
      createMonoPatchDraft('Imported'),
      'draft-connection-0',
      gainModule,
    )
    const document = patchDocumentFromDraft(draft, [gainModule])
    document.authoringMode = 'preserved'
    document.modules[1].hardware = {
      moduleIndex: 1,
      moduleTypeIndex: 7,
      version: 0,
      page: 0,
      headerColorId: 2,
      position: [1, 2, 3],
    }
    useWorkbenchStore.getState().setPatchDocument(document)

    useWorkbenchStore.getState().updateParameter(1, 'level_control', 42_000, 0)
    expect(
      useWorkbenchStore.getState().patchDocument?.modules[1].parameters[0]
        .rawValue,
    ).toBe(42_000)

    useWorkbenchStore.getState().undo()
    expect(
      useWorkbenchStore.getState().patchDocument?.modules[1].parameters[0]
        .rawValue,
    ).toBe(0)
  })

  it('authors and undoes a Free Routing endpoint graph', async () => {
    useWorkbenchStore.getState().setModuleCatalog(await getModuleCatalog())
    useWorkbenchStore.getState().createAdvancedDocument('Advanced')
    useWorkbenchStore.getState().addModule('looper-8s-once')
    useWorkbenchStore.getState().renameModule('module-0', 'Loop A')
    useWorkbenchStore
      .getState()
      .connectEndpoints('input', 'output_L', 'module-0', 'audio_in')

    expect(
      useWorkbenchStore.getState().patchDocument?.modules.at(-1)?.name,
    ).toBe('Loop A')
    expect(
      useWorkbenchStore.getState().patchDocument?.connections.at(-1),
    ).toMatchObject({
      sourceEndpointId: 'output_L',
      targetEndpointId: 'audio_in',
      kind: 'audio',
    })

    useWorkbenchStore.getState().undo()
    expect(
      useWorkbenchStore.getState().patchDocument?.connections,
    ).toHaveLength(2)
  })

  it('persists and undoes Workspace Layout without compiling a new Patch Revision', () => {
    useWorkbenchStore.getState().setModuleCatalog([gainModule])
    useWorkbenchStore.getState().createDraft('Positioned')
    const revision = useWorkbenchStore.getState().draftRevision
    useWorkbenchStore.getState().setCompilation({
      binary: new Uint8Array([0]),
      outputFilename: 'positioned.bin',
      findings: [],
      conformance: {
        unchangedFieldsPreserved: true,
        changedParameterCount: 0,
      },
      draftRevision: revision,
    })

    useWorkbenchStore
      .getState()
      .setWorkspacePosition('draft-input', { x: 120, y: -40 })

    expect(
      workspaceLayout(useWorkbenchStore.getState().patchDocument!)[
        'draft-input'
      ],
    ).toEqual({ x: 120, y: -40 })
    expect(useWorkbenchStore.getState().draftRevision).toBe(revision)
    expect(useWorkbenchStore.getState().compilationStatus).toBe('valid')

    useWorkbenchStore.getState().undo()
    expect(
      workspaceLayout(useWorkbenchStore.getState().patchDocument!),
    ).toEqual({})
    expect(useWorkbenchStore.getState().draftRevision).toBe(revision)

    useWorkbenchStore.getState().redo()
    expect(
      workspaceLayout(useWorkbenchStore.getState().patchDocument!)[
        'draft-input'
      ],
    ).toEqual({ x: 120, y: -40 })
  })

  it('records connector reordering as one undoable Authoring Operation', () => {
    useWorkbenchStore.getState().setModuleCatalog([gainModule])
    useWorkbenchStore.getState().createDraft('Scratch')
    useWorkbenchStore.getState().insertModule('draft-connection-0', 'vca')
    useWorkbenchStore.getState().insertModule('draft-connection-2', 'vca')
    useWorkbenchStore.getState().insertModule('draft-connection-4', 'vca')
    const before = useWorkbenchStore
      .getState()
      .patchDraft!.modules.map((module) => module.id)

    useWorkbenchStore
      .getState()
      .reorderModules('draft-module-0', 'draft-module-2')
    expect(
      useWorkbenchStore
        .getState()
        .patchDraft?.modules.map((module) => module.id),
    ).toEqual([
      'draft-input',
      'draft-module-0',
      'draft-module-2',
      'draft-module-1',
      'draft-output',
    ])

    useWorkbenchStore.getState().undo()
    expect(
      useWorkbenchStore
        .getState()
        .patchDraft?.modules.map((module) => module.id),
    ).toEqual(before)
  })

  it('colorizes a Module as one undoable Authoring Operation', () => {
    useWorkbenchStore.getState().setModuleCatalog([gainModule])
    useWorkbenchStore.getState().createDraft('Color Patch')

    useWorkbenchStore.getState().setModuleColor('draft-input', 13)
    expect(useWorkbenchStore.getState().patch?.modules[0].colorId).toBe(13)
    expect(useWorkbenchStore.getState().patchDocument?.colors[0]).toBe(13)

    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().patch?.modules[0].colorId).toBe(2)
  })

  it('undoes and redoes a structural Module insertion', () => {
    useWorkbenchStore.getState().setModuleCatalog([gainModule])
    useWorkbenchStore.getState().createDraft('Scratch')
    const connectionId =
      useWorkbenchStore.getState().patchDraft!.connections[0].id

    useWorkbenchStore.getState().insertModule(connectionId, 'vca')
    expect(useWorkbenchStore.getState().patchDraft?.modules).toHaveLength(3)
    expect(useWorkbenchStore.getState().patchDocument?.modules).toHaveLength(3)
    expect(useWorkbenchStore.getState().patchDocument?.format).toBe(
      'zoia-patch',
    )

    useWorkbenchStore.getState().undo()
    expect(useWorkbenchStore.getState().patchDraft?.modules).toHaveLength(2)
    expect(useWorkbenchStore.getState().patchDocument?.modules).toHaveLength(2)

    useWorkbenchStore.getState().redo()
    expect(useWorkbenchStore.getState().patchDraft?.modules).toHaveLength(3)
    expect(useWorkbenchStore.getState().patchDocument?.modules).toHaveLength(3)
  })
})
