import { create } from 'zustand'

import {
  addPatchDocumentModule,
  applyParameterEditsToDocument,
  connectPatchDocumentEndpoints,
  createAdvancedPatchDocument,
  createPatchDocumentControlMapping,
  createMonoPatchDraft,
  insertDraftModule,
  patchDocumentFromDraft,
  patchDocumentToDraft,
  projectPatchDocument,
  projectPatchDraft,
  renamePatchDocumentModule,
  removeDraftModule,
  removePatchDocumentConnection,
  removePatchDocumentModule,
  reorderDraftModules,
  setDraftModuleColor,
  setDraftParameter,
  setPatchDocumentControlMappingRange,
  setPatchDocumentModuleColor,
  setPatchDocumentModuleConfiguration,
  setSourceCalibrationFullScaleValue,
  withParameterEdit,
} from '#/lib/domain/patch'
import type {
  ModuleCatalogEntry,
  ParameterEdit,
  ControlMappingInput,
  PatchCompilation,
  PatchDocument,
  PatchDraft,
  PatchProjection,
  ZoiaModuleColorId,
} from '#/lib/domain/patch'

export type ColorTheme = 'dark' | 'light'
type CompilationStatus = 'idle' | 'pending' | 'valid' | 'invalid'
type HardwareTarget = 'zoia-pedal' | 'euroburo'
type Toast = { tone: 'warning' | 'error'; message: string }

function preferredTheme(): ColorTheme {
  if (typeof window === 'undefined') return 'dark'
  const savedTheme = window.localStorage.getItem('zoia-scope-theme')
  if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

function sameEdits(
  left: readonly ParameterEdit[],
  right: readonly ParameterEdit[],
) {
  return JSON.stringify(left) === JSON.stringify(right)
}

type WorkbenchState = {
  patch: PatchProjection | null
  patchDocument: PatchDocument | null
  basePatchDocument: PatchDocument | null
  patchDraft: PatchDraft | null
  moduleCatalog: ModuleCatalogEntry[]
  sourceFile: File | null
  theme: ColorTheme
  selectedModuleId: string | null
  importError: string | null
  isImporting: boolean
  parameterEdits: ParameterEdit[]
  draftRevision: number
  pastEdits: ParameterEdit[][]
  futureEdits: ParameterEdit[][]
  gestureStart: ParameterEdit[] | null
  pastDrafts: PatchDraft[]
  futureDrafts: PatchDraft[]
  pastDocuments: PatchDocument[]
  futureDocuments: PatchDocument[]
  draftGestureStart: PatchDraft | null
  compilationStatus: CompilationStatus
  compilation: PatchCompilation | null
  compilationError: string | null
  toast: Toast | null
  experimentalMode: boolean
  hardwareTarget: HardwareTarget
  firmwareVersion: string
  verifiedBy: string
  setExperimentalMode: (enabled: boolean) => void
  setHardwareProfile: (profile: {
    hardwareTarget?: HardwareTarget
    firmwareVersion?: string
    verifiedBy?: string
  }) => void
  setPatch: (patch: PatchProjection, sourceFile?: File) => void
  setPatchDocument: (document: PatchDocument) => void
  setModuleCatalog: (catalog: ModuleCatalogEntry[]) => void
  createDraft: (name: string) => void
  createAdvancedDocument: (name: string) => void
  restoreDraft: (draft: PatchDraft, history: PatchDraft[]) => void
  insertModule: (connectionId: string, catalogId: string) => void
  addModule: (catalogId: string) => void
  connectEndpoints: (
    sourceModuleId: string,
    sourceEndpointId: string,
    targetModuleId: string,
    targetEndpointId: string,
  ) => void
  createControlMapping: (mapping: ControlMappingInput) => void
  setControlMappingRange: (
    connectionId: string,
    minimumRaw: number,
    maximumRaw: number,
  ) => void
  setSourceCalibration: (
    moduleId: string,
    endpointId: string,
    fullScaleControllerValue: number,
  ) => void
  removeConnection: (connectionId: string) => void
  renameModule: (moduleId: string, name: string) => void
  setModuleColor: (moduleId: string, colorId: ZoiaModuleColorId) => void
  setModuleConfiguration: (
    moduleId: string,
    configuration: ModuleCatalogEntry,
  ) => void
  removeModule: (moduleId: string) => void
  reorderModules: (sourceModuleId: string, targetModuleId: string) => void
  selectModule: (moduleId: string | null) => void
  setImporting: (isImporting: boolean) => void
  setImportError: (message: string | null) => void
  beginParameterGesture: () => void
  updateParameter: (
    moduleId: number,
    parameterName: string,
    rawValue: number,
    originalRawValue: number,
  ) => void
  commitParameterGesture: () => void
  undo: () => void
  redo: () => void
  setCompilationPending: (draftRevision: number) => void
  setCompilation: (compilation: PatchCompilation) => void
  setCompilationError: (draftRevision: number, message: string) => void
  clearToast: () => void
  toggleTheme: () => void
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  patch: null,
  patchDocument: null,
  basePatchDocument: null,
  patchDraft: null,
  moduleCatalog: [],
  sourceFile: null,
  theme: preferredTheme(),
  selectedModuleId: null,
  importError: null,
  isImporting: false,
  parameterEdits: [],
  draftRevision: 0,
  pastEdits: [],
  futureEdits: [],
  gestureStart: null,
  pastDrafts: [],
  futureDrafts: [],
  pastDocuments: [],
  futureDocuments: [],
  draftGestureStart: null,
  compilationStatus: 'idle',
  compilation: null,
  compilationError: null,
  toast: null,
  experimentalMode: false,
  hardwareTarget: 'euroburo',
  firmwareVersion: '',
  verifiedBy: '',
  setExperimentalMode: (experimentalMode) => set({ experimentalMode }),
  setHardwareProfile: (profile) => set(profile),
  setPatch: (patch, sourceFile = undefined) =>
    set({
      patch,
      patchDocument: null,
      basePatchDocument: null,
      patchDraft: null,
      sourceFile: sourceFile ?? null,
      selectedModuleId: null,
      importError: null,
      parameterEdits: [],
      draftRevision: 1,
      pastEdits: [],
      futureEdits: [],
      gestureStart: null,
      pastDrafts: [],
      futureDrafts: [],
      pastDocuments: [],
      futureDocuments: [],
      draftGestureStart: null,
      compilationStatus: sourceFile ? 'pending' : 'idle',
      compilation: null,
      compilationError: null,
      toast: null,
    }),
  setPatchDocument: (patchDocument) => {
    const patchDraft = patchDocumentToDraft(patchDocument)
    set({
      patchDocument,
      basePatchDocument: patchDocument,
      patchDraft,
      patch: projectPatchDocument(patchDocument),
      sourceFile: null,
      selectedModuleId: null,
      importError: null,
      parameterEdits: [],
      draftRevision: 1,
      pastEdits: [],
      futureEdits: [],
      gestureStart: null,
      pastDrafts: [],
      futureDrafts: [],
      pastDocuments: [],
      futureDocuments: [],
      draftGestureStart: null,
      compilationStatus: 'pending',
      compilation: null,
      compilationError: null,
      toast: null,
    })
  },
  setModuleCatalog: (moduleCatalog) =>
    set((state) => ({
      moduleCatalog,
      patch:
        state.patchDraft === null
          ? state.patch
          : projectPatchDraft(state.patchDraft, moduleCatalog),
    })),
  createDraft: (name) =>
    set((state) => {
      const patchDraft = createMonoPatchDraft(name)
      const patchDocument = patchDocumentFromDraft(
        patchDraft,
        state.moduleCatalog,
      )
      return {
        patchDraft,
        patchDocument,
        basePatchDocument: patchDocument,
        patch: projectPatchDocument(patchDocument),
        sourceFile: null,
        selectedModuleId: null,
        importError: null,
        parameterEdits: [],
        draftRevision: 1,
        pastEdits: [],
        futureEdits: [],
        gestureStart: null,
        pastDrafts: [],
        futureDrafts: [],
        pastDocuments: [],
        futureDocuments: [],
        draftGestureStart: null,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
        toast: null,
      }
    }),
  createAdvancedDocument: (name) =>
    set((state) => {
      const patchDocument = createAdvancedPatchDocument(
        name,
        state.moduleCatalog,
      )
      return {
        patchDocument,
        basePatchDocument: patchDocument,
        patchDraft: null,
        patch: projectPatchDocument(patchDocument),
        sourceFile: null,
        selectedModuleId: null,
        parameterEdits: [],
        draftRevision: 1,
        pastEdits: [],
        futureEdits: [],
        pastDrafts: [],
        futureDrafts: [],
        pastDocuments: [],
        futureDocuments: [],
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
        toast: null,
      }
    }),
  restoreDraft: (patchDraft, history) =>
    set((state) => {
      const patchDocument = patchDocumentFromDraft(
        patchDraft,
        state.moduleCatalog,
      )
      return {
        patchDraft,
        patchDocument,
        basePatchDocument: patchDocument,
        patch: projectPatchDocument(patchDocument),
        sourceFile: null,
        selectedModuleId: null,
        importError: null,
        parameterEdits: [],
        draftRevision: 1,
        pastEdits: [],
        futureEdits: [],
        gestureStart: null,
        pastDrafts: history.slice(-20),
        futureDrafts: [],
        pastDocuments: [],
        futureDocuments: [],
        draftGestureStart: null,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
        toast: null,
      }
    }),
  insertModule: (connectionId, catalogId) =>
    set((state) => {
      if (!state.patchDraft) return state
      const catalogModule = state.moduleCatalog.find(
        (module) => module.id === catalogId,
      )
      if (!catalogModule) return state
      const patchDraft = insertDraftModule(
        state.patchDraft,
        connectionId,
        catalogModule,
      )
      if (patchDraft === state.patchDraft) return state
      const patchDocument = patchDocumentFromDraft(
        patchDraft,
        state.moduleCatalog,
        state.patchDocument ?? undefined,
      )
      return {
        patchDraft,
        patchDocument,
        patch: projectPatchDocument(patchDocument),
        selectedModuleId: `draft-module-${state.patchDraft.nextModuleSequence}`,
        pastDrafts: [...state.pastDrafts.slice(-99), state.patchDraft],
        futureDrafts: [],
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      }
    }),
  addModule: (catalogId) =>
    set((state) => {
      if (!state.patchDocument || state.patchDocument.authoringMode !== 'free')
        return state
      const configuration = state.moduleCatalog.find(
        (module) => module.id === catalogId,
      )
      if (!configuration) return state
      const patchDocument = addPatchDocumentModule(
        state.patchDocument,
        configuration,
      )
      return {
        patchDocument,
        basePatchDocument: patchDocument,
        patch: projectPatchDocument(patchDocument),
        selectedModuleId: patchDocument.modules.at(-1)?.id ?? null,
        pastDocuments: [...state.pastDocuments.slice(-99), state.patchDocument],
        futureDocuments: [],
        parameterEdits: [],
        pastEdits: [],
        futureEdits: [],
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      }
    }),
  connectEndpoints: (
    sourceModuleId,
    sourceEndpointId,
    targetModuleId,
    targetEndpointId,
  ) =>
    set((state) => {
      if (!state.patchDocument || state.patchDocument.authoringMode !== 'free')
        return state
      const patchDocument = connectPatchDocumentEndpoints(
        state.patchDocument,
        sourceModuleId,
        sourceEndpointId,
        targetModuleId,
        targetEndpointId,
      )
      if (patchDocument === state.patchDocument) return state
      return {
        patchDocument,
        basePatchDocument: patchDocument,
        patch: projectPatchDocument(patchDocument),
        pastDocuments: [...state.pastDocuments.slice(-99), state.patchDocument],
        futureDocuments: [],
        parameterEdits: [],
        pastEdits: [],
        futureEdits: [],
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      }
    }),
  createControlMapping: (mapping) =>
    set((state) => {
      if (!state.patchDocument || state.patchDocument.authoringMode !== 'free')
        return state
      const patchDocument = createPatchDocumentControlMapping(
        state.patchDocument,
        mapping,
      )
      if (patchDocument === state.patchDocument) return state
      return {
        patchDocument,
        basePatchDocument: patchDocument,
        patch: projectPatchDocument(patchDocument),
        pastDocuments: [...state.pastDocuments.slice(-99), state.patchDocument],
        futureDocuments: [],
        parameterEdits: [],
        pastEdits: [],
        futureEdits: [],
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      }
    }),
  setControlMappingRange: (connectionId, minimumRaw, maximumRaw) =>
    set((state) => {
      if (!state.patchDocument || state.patchDocument.authoringMode !== 'free')
        return state
      const patchDocument = setPatchDocumentControlMappingRange(
        state.patchDocument,
        connectionId,
        minimumRaw,
        maximumRaw,
      )
      if (patchDocument === state.patchDocument) return state
      return {
        patchDocument,
        basePatchDocument: patchDocument,
        patch: projectPatchDocument(patchDocument),
        pastDocuments: [...state.pastDocuments.slice(-99), state.patchDocument],
        futureDocuments: [],
        parameterEdits: [],
        pastEdits: [],
        futureEdits: [],
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      }
    }),
  setSourceCalibration: (moduleId, endpointId, fullScaleControllerValue) =>
    set((state) => {
      if (!state.patchDocument || state.patchDocument.authoringMode !== 'free')
        return state
      const patchDocument = setSourceCalibrationFullScaleValue(
        state.patchDocument,
        moduleId,
        endpointId,
        fullScaleControllerValue,
      )
      return {
        patchDocument,
        basePatchDocument: patchDocument,
        pastDocuments: [...state.pastDocuments.slice(-99), state.patchDocument],
        futureDocuments: [],
      }
    }),
  renameModule: (moduleId, name) =>
    set((state) => {
      if (!state.patchDocument || state.patchDocument.authoringMode !== 'free')
        return state
      const patchDocument = renamePatchDocumentModule(
        state.patchDocument,
        moduleId,
        name,
      )
      if (patchDocument === state.patchDocument) return state
      return {
        patchDocument,
        basePatchDocument: patchDocument,
        patch: projectPatchDocument(patchDocument),
        pastDocuments: [...state.pastDocuments.slice(-99), state.patchDocument],
        futureDocuments: [],
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      }
    }),
  setModuleColor: (moduleId, colorId) =>
    set((state) => {
      if (!state.patchDocument) return state
      if (state.patchDraft) {
        const patchDraft = setDraftModuleColor(
          state.patchDraft,
          moduleId,
          colorId,
        )
        if (patchDraft === state.patchDraft) return state
        const patchDocument = patchDocumentFromDraft(
          patchDraft,
          state.moduleCatalog,
          state.patchDocument,
        )
        return {
          patchDraft,
          patchDocument,
          basePatchDocument: patchDocument,
          patch: projectPatchDocument(patchDocument),
          pastDrafts: [...state.pastDrafts.slice(-99), state.patchDraft],
          futureDrafts: [],
          draftRevision: state.draftRevision + 1,
          compilationStatus: 'pending',
          compilation: null,
          compilationError: null,
        }
      }
      const patchDocument = setPatchDocumentModuleColor(
        state.patchDocument,
        moduleId,
        colorId,
      )
      if (patchDocument === state.patchDocument) return state
      const basePatchDocument = state.basePatchDocument
        ? setPatchDocumentModuleColor(
            state.basePatchDocument,
            moduleId,
            colorId,
          )
        : patchDocument
      return {
        patchDocument,
        basePatchDocument,
        patch: projectPatchDocument(patchDocument),
        pastDocuments: [...state.pastDocuments.slice(-99), state.patchDocument],
        futureDocuments: [],
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      }
    }),
  removeConnection: (connectionId) =>
    set((state) => {
      if (!state.patchDocument || state.patchDocument.authoringMode !== 'free')
        return state
      const patchDocument = removePatchDocumentConnection(
        state.patchDocument,
        connectionId,
      )
      if (patchDocument === state.patchDocument) return state
      return {
        patchDocument,
        basePatchDocument: patchDocument,
        patch: projectPatchDocument(patchDocument),
        pastDocuments: [...state.pastDocuments.slice(-99), state.patchDocument],
        futureDocuments: [],
        parameterEdits: [],
        pastEdits: [],
        futureEdits: [],
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      }
    }),
  setModuleConfiguration: (moduleId, configuration) =>
    set((state) => {
      if (!state.patchDocument || state.patchDocument.authoringMode !== 'free')
        return state
      const patchDocument = setPatchDocumentModuleConfiguration(
        state.patchDocument,
        moduleId,
        configuration,
      )
      if (patchDocument === state.patchDocument) return state
      return {
        patchDocument,
        basePatchDocument: patchDocument,
        patch: projectPatchDocument(patchDocument),
        moduleCatalog: [
          ...state.moduleCatalog.filter(
            (candidate) => candidate.id !== configuration.id,
          ),
          configuration,
        ],
        pastDocuments: [...state.pastDocuments.slice(-99), state.patchDocument],
        futureDocuments: [],
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      }
    }),
  removeModule: (moduleId) =>
    set((state) => {
      if (!state.patchDraft) {
        if (
          !state.patchDocument ||
          state.patchDocument.authoringMode !== 'free'
        )
          return state
        const patchDocument = removePatchDocumentModule(
          state.patchDocument,
          moduleId,
        )
        if (patchDocument === state.patchDocument) return state
        return {
          patchDocument,
          basePatchDocument: patchDocument,
          patch: projectPatchDocument(patchDocument),
          selectedModuleId: null,
          pastDocuments: [
            ...state.pastDocuments.slice(-99),
            state.patchDocument,
          ],
          futureDocuments: [],
          parameterEdits: [],
          pastEdits: [],
          futureEdits: [],
          draftRevision: state.draftRevision + 1,
          compilationStatus: 'pending',
          compilation: null,
          compilationError: null,
        }
      }
      const patchDraft = removeDraftModule(state.patchDraft, moduleId)
      if (patchDraft === state.patchDraft) return state
      const patchDocument = patchDocumentFromDraft(
        patchDraft,
        state.moduleCatalog,
        state.patchDocument ?? undefined,
      )
      return {
        patchDraft,
        patchDocument,
        patch: projectPatchDocument(patchDocument),
        selectedModuleId: null,
        pastDrafts: [...state.pastDrafts.slice(-99), state.patchDraft],
        futureDrafts: [],
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      }
    }),
  reorderModules: (sourceModuleId, targetModuleId) =>
    set((state) => {
      if (!state.patchDraft) return state
      const patchDraft = reorderDraftModules(
        state.patchDraft,
        sourceModuleId,
        targetModuleId,
      )
      if (patchDraft === state.patchDraft) return state
      const patchDocument = patchDocumentFromDraft(
        patchDraft,
        state.moduleCatalog,
        state.patchDocument ?? undefined,
      )
      return {
        patchDraft,
        patchDocument,
        patch: projectPatchDocument(patchDocument),
        selectedModuleId: null,
        pastDrafts: [...state.pastDrafts.slice(-99), state.patchDraft],
        futureDrafts: [],
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      }
    }),
  selectModule: (selectedModuleId) => set({ selectedModuleId }),
  setImporting: (isImporting) => set({ isImporting }),
  setImportError: (importError) => set({ importError }),
  beginParameterGesture: () =>
    set((state) =>
      state.patchDraft
        ? { draftGestureStart: state.draftGestureStart ?? state.patchDraft }
        : { gestureStart: state.gestureStart ?? [...state.parameterEdits] },
    ),
  updateParameter: (moduleId, parameterName, rawValue, originalRawValue) =>
    set((state) => {
      if (state.patchDraft) {
        const draftModule = state.patchDraft.modules.at(moduleId)
        if (!draftModule) return state
        const patchDraft = setDraftParameter(
          state.patchDraft,
          draftModule.id,
          parameterName,
          rawValue,
        )
        if (patchDraft === state.patchDraft) return state
        const patchDocument = patchDocumentFromDraft(
          patchDraft,
          state.moduleCatalog,
          state.patchDocument ?? undefined,
        )
        return {
          patchDraft,
          patchDocument,
          patch: projectPatchDocument(patchDocument),
          draftRevision: state.draftRevision + 1,
          pastDrafts: state.draftGestureStart
            ? state.pastDrafts
            : [...state.pastDrafts.slice(-99), state.patchDraft],
          futureDrafts: [],
          compilationStatus: 'pending',
          compilation: null,
          compilationError: null,
        }
      }

      const parameterEdits = withParameterEdit(
        state.parameterEdits,
        { moduleId, parameterName, rawValue },
        originalRawValue,
      )
      if (sameEdits(parameterEdits, state.parameterEdits)) return state
      const patchDocument = state.basePatchDocument
        ? applyParameterEditsToDocument(state.basePatchDocument, parameterEdits)
        : state.patchDocument
      return {
        parameterEdits,
        patchDocument,
        draftRevision: state.draftRevision + 1,
        pastEdits: state.gestureStart
          ? state.pastEdits
          : [...state.pastEdits.slice(-99), state.parameterEdits],
        futureEdits: [],
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      }
    }),
  commitParameterGesture: () =>
    set((state) => {
      if (state.patchDraft && state.draftGestureStart) {
        const changed = state.draftGestureStart !== state.patchDraft
        return {
          draftGestureStart: null,
          pastDrafts: changed
            ? [...state.pastDrafts.slice(-99), state.draftGestureStart]
            : state.pastDrafts,
          futureDrafts: changed ? [] : state.futureDrafts,
        }
      }
      if (!state.gestureStart) return state
      const changed = !sameEdits(state.gestureStart, state.parameterEdits)
      return {
        gestureStart: null,
        pastEdits: changed
          ? [...state.pastEdits.slice(-99), state.gestureStart]
          : state.pastEdits,
        futureEdits: changed ? [] : state.futureEdits,
      }
    }),
  undo: () => {
    const state = get()
    if (
      state.patchDocument?.authoringMode === 'free' &&
      state.pastEdits.length === 0 &&
      state.pastDocuments.length > 0
    ) {
      const previous = state.pastDocuments.at(-1)!
      set({
        patchDocument: previous,
        basePatchDocument: previous,
        patch: projectPatchDocument(previous),
        selectedModuleId: null,
        pastDocuments: state.pastDocuments.slice(0, -1),
        futureDocuments: [state.patchDocument, ...state.futureDocuments].slice(
          0,
          100,
        ),
        parameterEdits: [],
        futureEdits: [],
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      })
      return
    }
    if (state.patchDraft) {
      const previous = state.pastDrafts.at(-1)
      if (!previous) return
      const patchDocument = patchDocumentFromDraft(
        previous,
        state.moduleCatalog,
        state.patchDocument ?? undefined,
      )
      set({
        patchDraft: previous,
        patchDocument,
        patch: projectPatchDocument(patchDocument),
        selectedModuleId: null,
        pastDrafts: state.pastDrafts.slice(0, -1),
        futureDrafts: [state.patchDraft, ...state.futureDrafts].slice(0, 100),
        draftGestureStart: null,
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      })
      return
    }
    const previous = state.pastEdits.at(-1)
    if (!previous) return
    const patchDocument = state.basePatchDocument
      ? applyParameterEditsToDocument(state.basePatchDocument, previous)
      : state.patchDocument
    set({
      parameterEdits: previous,
      patchDocument,
      pastEdits: state.pastEdits.slice(0, -1),
      futureEdits: [state.parameterEdits, ...state.futureEdits].slice(0, 100),
      gestureStart: null,
      draftRevision: state.draftRevision + 1,
      compilationStatus: 'pending',
      compilation: null,
      compilationError: null,
    })
  },
  redo: () => {
    const state = get()
    if (
      state.patchDocument?.authoringMode === 'free' &&
      state.futureEdits.length === 0 &&
      state.futureDocuments.length > 0
    ) {
      const next = state.futureDocuments.at(0)!
      set({
        patchDocument: next,
        basePatchDocument: next,
        patch: projectPatchDocument(next),
        selectedModuleId: null,
        pastDocuments: [...state.pastDocuments.slice(-99), state.patchDocument],
        futureDocuments: state.futureDocuments.slice(1),
        parameterEdits: [],
        pastEdits: [],
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      })
      return
    }
    if (state.patchDraft) {
      const next = state.futureDrafts.at(0)
      if (!next) return
      const patchDocument = patchDocumentFromDraft(
        next,
        state.moduleCatalog,
        state.patchDocument ?? undefined,
      )
      set({
        patchDraft: next,
        patchDocument,
        patch: projectPatchDocument(patchDocument),
        selectedModuleId: null,
        pastDrafts: [...state.pastDrafts.slice(-99), state.patchDraft],
        futureDrafts: state.futureDrafts.slice(1),
        draftGestureStart: null,
        draftRevision: state.draftRevision + 1,
        compilationStatus: 'pending',
        compilation: null,
        compilationError: null,
      })
      return
    }
    const next = state.futureEdits.at(0)
    if (!next) return
    const patchDocument = state.basePatchDocument
      ? applyParameterEditsToDocument(state.basePatchDocument, next)
      : state.patchDocument
    set({
      parameterEdits: next,
      patchDocument,
      pastEdits: [...state.pastEdits.slice(-99), state.parameterEdits],
      futureEdits: state.futureEdits.slice(1),
      gestureStart: null,
      draftRevision: state.draftRevision + 1,
      compilationStatus: 'pending',
      compilation: null,
      compilationError: null,
    })
  },
  setCompilationPending: (draftRevision) => {
    if (draftRevision === get().draftRevision) {
      set({ compilationStatus: 'pending', compilationError: null })
    }
  },
  setCompilation: (compilation) => {
    if (compilation.draftRevision !== get().draftRevision) return
    const errors = compilation.findings.filter(
      (finding) => finding.severity === 'error',
    )
    const warnings = compilation.findings.filter(
      (finding) =>
        finding.severity === 'warning' &&
        finding.code !== 'hardware_unverified',
    )
    set({
      compilation,
      compilationStatus: errors.length ? 'invalid' : 'valid',
      compilationError: null,
      toast: errors[0]
        ? { tone: 'error', message: errors[0].message }
        : warnings[0]
          ? { tone: 'warning', message: warnings[0].message }
          : null,
    })
  },
  setCompilationError: (draftRevision, message) => {
    if (draftRevision !== get().draftRevision) return
    set({
      compilationStatus: 'invalid',
      compilation: null,
      compilationError: message,
      toast: { tone: 'error', message },
    })
  },
  clearToast: () => set({ toast: null }),
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = theme
      window.localStorage.setItem('zoia-scope-theme', theme)
      return { theme }
    }),
}))
