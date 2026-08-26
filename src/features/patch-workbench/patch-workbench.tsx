import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import type {
  Connection,
  EdgeMouseHandler,
  IsValidConnection,
  Node,
  NodeMouseHandler,
  OnNodeDrag,
  OnReconnect,
} from '@xyflow/react'
import {
  Bug,
  Cable,
  CheckCircle2,
  Download,
  FileClock,
  FileJson,
  FilePlus2,
  FileUp,
  FlaskConical,
  Globe2,
  LoaderCircle,
  Moon,
  Plus,
  Radio,
  Redo2,
  RotateCcw,
  Search,
  Sun,
  TriangleAlert,
  Undo2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'

import {
  compilePatchDocument,
  createPatchVersion,
  filterModuleCatalog,
  getModuleCatalog,
  groupModuleCatalog,
  importPatchDocument,
  loadPatchDraftSession,
  loadPatchHistory,
  parsePatchVersion,
  patchVersionMetadata,
  resolveExperimentalModuleCatalogEntry,
  savePatchDraftSession,
  savePatchVersion,
  samePatchVersionContent,
  serializePatchDocument,
  sourceCalibrationFullScaleValue,
  versionedPatchFilename,
  workspaceLayout,
} from '#/lib/domain/patch'
import type { PatchDraftSession, PatchVersion } from '#/lib/domain/patch'
import { createCompatibilityReportUrl } from '#/lib/domain/compatibility-report'
import {
  patchStorageProvenance,
  withPatchStorageProvenance,
} from '#/lib/domain/patch-storage'
import type { PatchStoragePatchDetail } from '#/lib/domain/patch-storage'
import {
  acceptHostedCodecConsent,
  hasHostedCodecConsent,
  requiresHostedCodec,
} from '#/lib/infra/codec-consent'

import { ConnectionInspector } from './connection-inspector'
import { demoPatch } from './demo-patch'
import { layoutPatch } from './graph-layout'
import { ModuleInspector } from './module-inspector'
import { ModuleNode } from './module-node'
import { PatchStorageBrowser } from './patch-storage-browser'
import { SignalEdge } from './signal-edge'
import { VersionInspector } from './version-inspector'
import { useWorkbenchStore } from './workbench-store'

const nodeTypes = { module: ModuleNode }
const edgeTypes = { signal: SignalEdge }

export function PatchWorkbench() {
  return (
    <ReactFlowProvider>
      <PatchWorkbenchSurface />
    </ReactFlowProvider>
  )
}

function PatchWorkbenchSurface() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const versionFileInputRef = useRef<HTMLInputElement>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [codecConsent, setCodecConsent] = useState(hasHostedCodecConsent)
  const [pendingCodecFile, setPendingCodecFile] = useState<File | null>(null)
  const [pendingPatchStoragePatch, setPendingPatchStoragePatch] =
    useState<PatchStoragePatchDetail | null>(null)
  const [isCodecDisclosureOpen, setIsCodecDisclosureOpen] = useState(false)
  const [isPatchStorageOpen, setIsPatchStorageOpen] = useState(false)
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [reportKind, setReportKind] = useState<'app' | 'module'>('app')
  const [reportModuleId, setReportModuleId] = useState('')
  const [reportHardware, setReportHardware] = useState('Euroburo')
  const [reportFirmware, setReportFirmware] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [reportExpected, setReportExpected] = useState('')
  const [reportActual, setReportActual] = useState('')
  const [patchHash, setPatchHash] = useState('')
  const [isSavingVersion, setIsSavingVersion] = useState(false)
  const [isSaveVersionOpen, setIsSaveVersionOpen] = useState(false)
  const [isVersionInspectorOpen, setIsVersionInspectorOpen] = useState(false)
  const [versionMessage, setVersionMessage] = useState('')
  const [patchHistory, setPatchHistory] = useState<PatchVersion[]>([])
  const [isNewPatchOpen, setIsNewPatchOpen] = useState(false)
  const [newPatchName, setNewPatchName] = useState('New Patch')
  const [newPatchMode, setNewPatchMode] = useState<'linear' | 'free'>('linear')
  const [isConnectionOpen, setIsConnectionOpen] = useState(false)
  const [sourceEndpointValue, setSourceEndpointValue] = useState('')
  const [targetEndpointValue, setTargetEndpointValue] = useState('')
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [libraryQuery, setLibraryQuery] = useState('')
  const [insertionConnectionId, setInsertionConnectionId] = useState('')
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [recoverableSession, setRecoverableSession] =
    useState<PatchDraftSession | null>(null)
  const [isDraftSaved, setIsDraftSaved] = useState(false)
  const [dismissedValidationKey, setDismissedValidationKey] = useState<
    string | null
  >(null)
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null)
  const [inspectedConnectionId, setInspectedConnectionId] = useState<
    string | null
  >(null)
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node>([])
  const {
    patch,
    patchDocument,
    patchDraft,
    moduleCatalog,
    theme,
    selectedModuleId,
    importError,
    isImporting,
    parameterEdits,
    draftRevision,
    pastEdits,
    futureEdits,
    pastDrafts,
    futureDrafts,
    pastDocuments,
    futureDocuments,
    compilationStatus,
    compilation,
    compilationError,
    toast,
    setPatch,
    setPatchDocument,
    setVersionedPatchDocument,
    setModuleCatalog,
    createDraft,
    createAdvancedDocument,
    restoreDraft,
    insertModule,
    addModule,
    connectEndpoints,
    reconnectEndpoints,
    setWorkspacePosition,
    resetWorkspaceLayout,
    createControlMapping,
    setConnectionStrength,
    setControlMappingRange,
    setSourceCalibration,
    removeConnection,
    renameModule,
    setModuleColor,
    setModuleConfiguration,
    removeModule,
    selectModule,
    setImporting,
    setImportError,
    beginParameterGesture,
    updateParameter,
    commitParameterGesture,
    undo,
    redo,
    setCompilationPending,
    setCompilation,
    setCompilationError,
    clearToast,
    toggleTheme,
  } = useWorkbenchStore()
  const patchDocumentRef = useRef(patchDocument)
  patchDocumentRef.current = patchDocument
  const hasAuthoring = Boolean(patchDocument)
  const provenance = patchStorageProvenance(patchDocument)
  const isFreeAuthoring = patchDocument?.authoringMode === 'free'
  const canInsertModules = Boolean(patchDraft)
  const canConnectEndpoints = Boolean(isFreeAuthoring)
  const sourceEndpoints = useMemo(
    () =>
      patchDocument?.modules.flatMap((module) =>
        module.endpoints
          .filter(
            (endpoint) =>
              endpoint.kind === 'audioOutput' || endpoint.kind === 'cvOutput',
          )
          .map((endpoint) => ({
            value: `${module.id}::${endpoint.id}`,
            label: `${module.name} · ${endpoint.name}`,
          })),
      ) ?? [],
    [patchDocument],
  )
  const targetEndpoints = useMemo(
    () =>
      patchDocument?.modules.flatMap((module) =>
        module.endpoints
          .filter(
            (endpoint) =>
              endpoint.kind === 'audioInput' || endpoint.kind === 'cvInput',
          )
          .map((endpoint) => ({
            value: `${module.id}::${endpoint.id}`,
            label: `${module.name} · ${endpoint.name}`,
          })),
      ) ?? [],
    [patchDocument],
  )
  const signalColor = theme === 'light' ? '#137a3b' : '#78f0a3'
  const openModuleLibraryForConnection = useCallback((connectionId: string) => {
    setInsertionConnectionId(connectionId)
    setLibraryQuery('')
    setIsLibraryOpen(true)
  }, [])
  const graph = useMemo(
    () =>
      patch
        ? layoutPatch(patch, signalColor, {
            canConnectEndpoints,
            canInsertModules,
            patchDocument,
            workspaceLayout: patchDocument
              ? workspaceLayout(patchDocument)
              : undefined,
            onInsertConnection: openModuleLibraryForConnection,
          })
        : null,
    [
      canConnectEndpoints,
      canInsertModules,
      openModuleLibraryForConnection,
      patch,
      patchDocument,
      signalColor,
    ],
  )
  const displayedEdges = useMemo(
    () =>
      graph?.edges.map((edge) => ({
        ...edge,
        selected: edge.id === selectedConnectionId,
      })) ?? [],
    [graph, selectedConnectionId],
  )
  useEffect(() => {
    setFlowNodes(graph?.nodes ?? [])
  }, [graph, setFlowNodes])

  const filteredCatalog = useMemo(
    () =>
      filterModuleCatalog(
        moduleCatalog,
        isFreeAuthoring ? 'free' : 'linear',
        libraryQuery,
      ),
    [isFreeAuthoring, libraryQuery, moduleCatalog],
  )
  const groupedCatalog = useMemo(
    () => groupModuleCatalog(filteredCatalog),
    [filteredCatalog],
  )
  const reportUrl = useMemo(
    () =>
      createCompatibilityReportUrl({
        kind: reportKind,
        description: reportKind === 'module' ? reportActual : reportDescription,
        expected: reportExpected,
        actual: reportActual,
        hardwareTarget: reportHardware,
        firmwareVersion: reportFirmware,
        patch: patchDocument,
        patchHash,
        moduleId: reportModuleId,
      }),
    [
      patchDocument,
      patchHash,
      reportActual,
      reportDescription,
      reportExpected,
      reportFirmware,
      reportHardware,
      reportKind,
      reportModuleId,
    ],
  )

  useEffect(() => {
    if (!patchDocument) {
      setPatchHash('')
      return
    }
    let active = true
    void crypto.subtle
      .digest(
        'SHA-256',
        new TextEncoder().encode(serializePatchDocument(patchDocument)),
      )
      .then((digest) => {
        if (!active) return
        setPatchHash(
          [...new Uint8Array(digest)]
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join(''),
        )
      })
    return () => {
      active = false
    }
  }, [patchDocument])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    void loadPatchDraftSession()
      .then(setRecoverableSession)
      .catch(() => setRecoverableSession(null))
  }, [])

  useEffect(() => {
    if (!patchDocument) {
      setPatchHistory([])
      return
    }
    const metadata = patchVersionMetadata(patchDocument)
    if (!metadata) {
      setPatchHistory([])
      return
    }
    void loadPatchHistory(metadata.seriesId)
      .then((history) => {
        const includesCurrent = history.some(
          (version) => version.metadata.version === metadata.version,
        )
        setPatchHistory(
          includesCurrent
            ? history
            : [...history, { metadata, document: patchDocument }].sort(
                (left, right) => left.metadata.version - right.metadata.version,
              ),
        )
      })
      .catch(() => setPatchHistory([{ metadata, document: patchDocument }]))
  }, [
    patchDocument?.documentId,
    patchDocument ? patchVersionMetadata(patchDocument)?.version : undefined,
  ])

  useEffect(() => {
    const controller = new AbortController()
    void getModuleCatalog({ signal: controller.signal })
      .then(setModuleCatalog)
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError')
        )
          return
        setImportError(
          error instanceof Error
            ? error.message
            : 'The Module catalog could not be loaded.',
        )
      })
      .finally(() => setIsCatalogLoading(false))
    return () => controller.abort()
  }, [setImportError, setModuleCatalog])

  useEffect(() => {
    if (!patchDraft) return
    setIsDraftSaved(false)
    const timeout = window.setTimeout(() => {
      void savePatchDraftSession({
        savedAt: new Date().toISOString(),
        draft: patchDraft,
        history: pastDrafts.slice(-20),
      })
        .then(() => setIsDraftSaved(true))
        .catch(() =>
          setImportError(
            'Browser recovery could not save the Patch Document locally.',
          ),
        )
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [draftRevision, patchDraft, pastDrafts, setImportError])

  useEffect(() => {
    const documentForCompilation = patchDocumentRef.current
    if (!documentForCompilation || !codecConsent) return
    const controller = new AbortController()
    const revision = draftRevision
    setCompilationPending(revision)
    const timeout = window.setTimeout(() => {
      void compilePatchDocument(
        { document: documentForCompilation, patchRevision: revision },
        { signal: controller.signal },
      )
        .then(setCompilation)
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError')
            return
          setCompilationError(
            revision,
            error instanceof Error
              ? error.message
              : 'Patch Compilation failed.',
          )
        })
    }, 400)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [
    codecConsent,
    draftRevision,
    setCompilation,
    setCompilationError,
    setCompilationPending,
  ])

  useEffect(() => {
    if (!patchDraft || !nodesInitialized) return
    const frame = window.requestAnimationFrame(() => {
      void fitView({
        padding: 0.24,
        duration: 220,
        minZoom: 0.72,
        maxZoom: 1.05,
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [fitView, nodesInitialized, patchDraft?.modules.length])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(clearToast, 4_500)
    return () => window.clearTimeout(timeout)
  }, [clearToast, toast])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.matches('input, textarea, select, [contenteditable="true"]') ??
        false
      if (
        !isTyping &&
        selectedConnectionId &&
        (event.key === 'Delete' || event.key === 'Backspace')
      ) {
        event.preventDefault()
        removeConnection(selectedConnectionId)
        setSelectedConnectionId(null)
        setInspectedConnectionId(null)
        return
      }
      if (event.key === 'Escape') {
        setSelectedConnectionId(null)
        setInspectedConnectionId(null)
        return
      }
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [redo, removeConnection, selectedConnectionId, undo])

  const loadFile = async (
    file: File | undefined,
    patchStoragePatch: PatchStoragePatchDetail | null = null,
  ) => {
    if (!file) return
    if (requiresHostedCodec(file) && !hasHostedCodecConsent()) {
      setPendingCodecFile(file)
      setPendingPatchStoragePatch(patchStoragePatch)
      setIsCodecDisclosureOpen(true)
      return
    }
    setImportError(null)
    setImporting(true)
    try {
      const document = await importPatchDocument(file)
      setPatchDocument(
        patchStoragePatch
          ? withPatchStorageProvenance(document, patchStoragePatch)
          : document,
      )
      setIsLibraryOpen(false)
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : 'The patch could not be imported.',
      )
    } finally {
      setImporting(false)
    }
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void loadFile(event.target.files?.[0])
    event.target.value = ''
  }

  const onVersionFilesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (!files.length) return
    try {
      const versions = await Promise.all(
        files.map(async (file) =>
          parsePatchVersion(JSON.parse(await file.text())),
        ),
      )
      const seriesIds = new Set(
        versions.map((version) => version.metadata.seriesId),
      )
      if (seriesIds.size !== 1) {
        throw new Error('Choose versions from one Patch History at a time.')
      }
      const importedSeriesId = versions[0].metadata.seriesId
      const existingVersions = patchHistory.filter(
        (version) => version.metadata.seriesId === importedSeriesId,
      )
      const merged = new Map<number, PatchVersion>()
      for (const version of [...existingVersions, ...versions]) {
        merged.set(version.metadata.version, version)
        await savePatchVersion(version)
      }
      const history = [...merged.values()].sort(
        (left, right) => left.metadata.version - right.metadata.version,
      )
      setPatchHistory(history)
      setIsVersionInspectorOpen(true)
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : 'Patch Versions could not be loaded.',
      )
    }
  }

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    void loadFile(event.dataTransfer.files[0])
  }

  const acceptCodecDisclosure = () => {
    const file = pendingCodecFile
    const patchStoragePatch = pendingPatchStoragePatch
    acceptHostedCodecConsent()
    setCodecConsent(true)
    setPendingCodecFile(null)
    setPendingPatchStoragePatch(null)
    setIsCodecDisclosureOpen(false)
    if (file) void loadFile(file, patchStoragePatch)
  }

  const onNodeClick: NodeMouseHandler = (_event, node) => {
    setSelectedConnectionId(null)
    setInspectedConnectionId(null)
    selectModule(node.id)
  }
  const onNodeDragStart: OnNodeDrag = () => {
    setSelectedConnectionId(null)
    selectModule(null)
    setIsLibraryOpen(false)
  }
  const onNodeDragStop: OnNodeDrag = (_event, node) => {
    setWorkspacePosition(node.id, node.position)
  }
  const onEdgeClick: EdgeMouseHandler = (_event, edge) => {
    if (patchDraft) {
      openModuleLibraryForConnection(edge.id)
      return
    }
    if (isFreeAuthoring) {
      selectModule(null)
      setSelectedConnectionId(edge.id)
    }
  }
  const onEdgeDoubleClick: EdgeMouseHandler = (_event, edge) => {
    if (!patchDocument) return
    setIsLibraryOpen(false)
    selectModule(null)
    setSelectedConnectionId(edge.id)
    setInspectedConnectionId(edge.id)
  }
  const isValidConnection: IsValidConnection = useCallback(
    (connection) => {
      if (
        !patchDocument ||
        !isFreeAuthoring ||
        !connection.sourceHandle ||
        !connection.targetHandle ||
        connection.source === connection.target
      )
        return false
      const source = patchDocument.modules
        .find((module) => module.id === connection.source)
        ?.endpoints.find((endpoint) => endpoint.id === connection.sourceHandle)
      const target = patchDocument.modules
        .find((module) => module.id === connection.target)
        ?.endpoints.find((endpoint) => endpoint.id === connection.targetHandle)
      return Boolean(
        (source?.kind === 'audioOutput' && target?.kind === 'audioInput') ||
        (source?.kind === 'cvOutput' && target?.kind === 'cvInput'),
      )
    },
    [isFreeAuthoring, patchDocument],
  )
  const onConnect = useCallback(
    (connection: Connection) => {
      if (
        !isValidConnection(connection) ||
        !connection.sourceHandle ||
        !connection.targetHandle
      )
        return
      connectEndpoints(
        connection.source,
        connection.sourceHandle,
        connection.target,
        connection.targetHandle,
      )
    },
    [connectEndpoints, isValidConnection],
  )
  const onReconnect: OnReconnect = useCallback(
    (edge, connection) => {
      if (
        !isValidConnection(connection) ||
        !connection.sourceHandle ||
        !connection.targetHandle
      )
        return
      reconnectEndpoints(
        edge.id,
        connection.source,
        connection.sourceHandle,
        connection.target,
        connection.targetHandle,
      )
    },
    [isValidConnection, reconnectEndpoints],
  )

  const resetLayout = () => {
    if (!patch || !patchDocument) return
    const automatic = layoutPatch(patch, signalColor, {
      canConnectEndpoints,
      canInsertModules,
      patchDocument,
      workspaceLayout: {},
      onInsertConnection: openModuleLibraryForConnection,
    })
    resetWorkspaceLayout(
      Object.fromEntries(
        automatic.nodes.map((node) => [node.id, node.position]),
      ),
    )
    window.requestAnimationFrame(() => {
      void fitView({
        padding: 0.24,
        duration: 220,
        minZoom: 0.72,
        maxZoom: 1.05,
      })
    })
  }

  const openReportDialog = () => {
    setReportKind('app')
    setReportModuleId(selectedModuleId ?? patchDocument?.modules[0]?.id ?? '')
    setReportHardware('Euroburo')
    setReportFirmware('')
    setReportDescription('')
    setReportExpected('')
    setReportActual('')
    setIsReportOpen(true)
  }

  const openModuleLibrary = () => {
    if (!patchDraft && !isFreeAuthoring) return
    if (patchDraft) {
      setInsertionConnectionId(
        insertionConnectionId || patchDraft.connections[0]?.id || '',
      )
    }
    setLibraryQuery('')
    setIsLibraryOpen(true)
  }

  const submitNewPatch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newPatchName.trim()
    if (!name || name.length > 16 || !/^[\x20-\x7E]+$/.test(name)) return
    if (newPatchMode === 'free') createAdvancedDocument(name)
    else createDraft(name)
    setIsNewPatchOpen(false)
    setIsLibraryOpen(false)
  }

  const openConnectionDialog = () => {
    setSourceEndpointValue(sourceEndpoints[0]?.value ?? '')
    setTargetEndpointValue(targetEndpoints[0]?.value ?? '')
    setIsConnectionOpen(true)
  }

  const submitConnection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const [sourceModuleId, sourceEndpointId] = sourceEndpointValue.split('::')
    const [targetModuleId, targetEndpointId] = targetEndpointValue.split('::')
    if (
      !sourceModuleId ||
      !sourceEndpointId ||
      !targetModuleId ||
      !targetEndpointId
    )
      return
    connectEndpoints(
      sourceModuleId,
      sourceEndpointId,
      targetModuleId,
      targetEndpointId,
    )
    setIsConnectionOpen(false)
  }

  const submitSaveVersion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const currentDocument = useWorkbenchStore.getState().patchDocument
    if (!currentDocument || !versionMessage.trim()) return
    const sourceVersion = patchVersionMetadata(currentDocument)
    const savedSource = sourceVersion
      ? patchHistory.find(
          (version) => version.metadata.version === sourceVersion.version,
        )
      : patchHistory.at(-1)
    if (
      savedSource &&
      samePatchVersionContent(savedSource.document, currentDocument)
    ) {
      setImportError('Change the Patch Document before saving another version.')
      setIsSaveVersionOpen(false)
      return
    }
    setIsSavingVersion(true)
    try {
      const version = createPatchVersion(
        currentDocument,
        patchHistory,
        versionMessage,
      )
      await savePatchVersion(version)
      setVersionedPatchDocument(version.document)
      setPatchHistory((history) => [...history, version])
      const blob = new Blob([serializePatchDocument(version.document)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = versionedPatchFilename(
        version.document.name,
        version.metadata.version,
      )
      link.click()
      URL.revokeObjectURL(url)
      setVersionMessage('')
      setIsSaveVersionOpen(false)
      setIsVersionInspectorOpen(true)
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : 'Patch Version could not be saved.',
      )
    } finally {
      setIsSavingVersion(false)
    }
  }

  const restorePatchVersion = (version: PatchVersion) => {
    setPatchDocument(version.document)
    setIsVersionInspectorOpen(false)
  }

  const exportBinary = async () => {
    if (!hasHostedCodecConsent()) {
      setPendingCodecFile(null)
      setPendingPatchStoragePatch(null)
      setIsCodecDisclosureOpen(true)
      return
    }
    const state = useWorkbenchStore.getState()
    if (!state.patchDocument) return
    const revision = state.draftRevision
    setIsExporting(true)
    try {
      const result = await compilePatchDocument({
        document: state.patchDocument,
        patchRevision: revision,
      })
      setCompilation(result)
      const hasErrors = result.findings.some(
        (finding) => finding.severity === 'error',
      )
      if (
        !result.binary ||
        hasErrors ||
        revision !== useWorkbenchStore.getState().draftRevision
      ) {
        return
      }

      const blob = new Blob([result.binary.buffer], {
        type: 'application/octet-stream',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.outputFilename
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setCompilationError(
        revision,
        error instanceof Error ? error.message : 'Patch Compilation failed.',
      )
    } finally {
      setIsExporting(false)
    }
  }

  const findings =
    compilation?.draftRevision === draftRevision ? compilation.findings : []
  const validationErrors = findings.filter(
    (finding) => finding.severity === 'error',
  )
  const validationKey = [
    draftRevision,
    compilationError ?? '',
    ...findings.map(
      (finding) =>
        `${finding.severity}:${finding.code}:${finding.moduleId ?? ''}:${finding.parameterName ?? ''}`,
    ),
  ].join('|')
  const showValidation =
    hasAuthoring &&
    Boolean(compilationError || findings.length) &&
    dismissedValidationKey !== validationKey
  const canUndo = patchDraft
    ? pastDrafts.length > 0 || pastDocuments.length > 0
    : pastEdits.length > 0 || pastDocuments.length > 0
  const canRedo = patchDraft
    ? futureDrafts.length > 0 || futureDocuments.length > 0
    : futureEdits.length > 0 || futureDocuments.length > 0
  const editCount = patchDraft
    ? Math.max(0, patchDraft.modules.length - 2)
    : parameterEdits.length

  return (
    <main
      className={`workbench ${hasAuthoring ? 'has-authoring' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <header className="instrument-bar">
        <div className="brand-lockup" aria-label="ZOIA Scope patch editor">
          <span className="brand-mark" aria-hidden="true">
            <Radio size={22} />
          </span>
          <div>
            <strong>ZOIA / SCOPE</strong>
            <span>Logical patch editor</span>
          </div>
        </div>

        {patch ? (
          <div className="patch-readout" aria-label="Loaded patch">
            <span>{patchDocument ? 'PATCH DOCUMENT' : 'PATCH ACQUIRED'}</span>
            <strong>{patch.name}</strong>
            <small>
              {patchDraft ? (
                `MONO · ${isDraftSaved ? 'RECOVERY SAVED' : 'SAVING RECOVERY'}`
              ) : provenance ? (
                <a href={provenance.url} target="_blank" rel="noreferrer">
                  PATCHSTORAGE · {provenance.author.name}
                </a>
              ) : (
                patch.sourceFilename
              )}
            </small>
          </div>
        ) : (
          <div className="patch-readout is-idle">
            <span>LOCAL WORKSPACE</span>
            <strong>READY</strong>
            <small>Create, open, or recover a Patch Document</small>
          </div>
        )}

        <div className="instrument-actions">
          <button
            className="instrument-button is-secondary"
            type="button"
            onClick={() => setIsNewPatchOpen(true)}
            disabled={isCatalogLoading}
            title="New Patch"
          >
            {isCatalogLoading ? (
              <LoaderCircle className="is-spinning" size={17} />
            ) : (
              <FilePlus2 size={17} />
            )}
            New patch
          </button>
          <button
            className="instrument-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            title="Import Patch"
          >
            {isImporting ? (
              <RotateCcw className="is-spinning" size={17} />
            ) : (
              <FileUp size={17} />
            )}
            {isImporting ? 'Acquiring…' : 'Import patch'}
          </button>
          <button
            className="instrument-button is-secondary"
            type="button"
            onClick={() => setIsPatchStorageOpen(true)}
            disabled={isImporting}
            title="Browse PatchStorage"
          >
            <Globe2 size={17} />
            Browse PatchStorage
          </button>
          <button
            className="instrument-button is-secondary"
            type="button"
            onClick={openReportDialog}
            title="Report issue"
          >
            <Bug size={17} />
            Report issue
          </button>
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".bin,.json,application/json,application/octet-stream"
            onChange={onFileChange}
          />
          <input
            ref={versionFileInputRef}
            className="sr-only"
            type="file"
            multiple
            accept=".json,application/json"
            onChange={(event) => void onVersionFilesChange(event)}
          />
        </div>
      </header>

      {patch && hasAuthoring ? (
        <section
          className="authoring-bar"
          aria-label="Patch authoring controls"
        >
          <div className="history-controls">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              aria-label="Undo Authoring Operation"
              title="Undo (⌘Z)"
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              aria-label="Redo Authoring Operation"
              title="Redo (⇧⌘Z)"
            >
              <Redo2 size={16} />
            </button>
          </div>
          {patchDraft || isFreeAuthoring ? (
            <button
              className="insert-module-button"
              type="button"
              onClick={openModuleLibrary}
            >
              <Plus size={15} />{' '}
              {isFreeAuthoring ? 'Add module' : 'Insert module'}
            </button>
          ) : null}
          {isFreeAuthoring ? (
            <button
              className="connect-module-button"
              type="button"
              onClick={openConnectionDialog}
            >
              <Cable size={15} /> Connect
            </button>
          ) : null}
          <button
            className="reset-layout-button"
            type="button"
            onClick={resetLayout}
            title="Apply automatic canvas layout"
          >
            <RotateCcw size={15} /> Reset layout
          </button>
          <label className="module-jump">
            <span>EDIT</span>
            <select
              value={selectedModuleId ?? ''}
              onChange={(event) => selectModule(event.target.value || null)}
              aria-label="Choose Module to edit"
            >
              <option value="">Choose Module…</option>
              {patch.modules
                .filter(
                  (module) =>
                    patchDraft ||
                    module.parameters.some(
                      (parameter) =>
                        parameter.kind === 'parameter' &&
                        typeof parameter.rawValue === 'number',
                    ) ||
                    patchDocument?.modules
                      .find((candidate) => candidate.id === module.id)
                      ?.endpoints.some(
                        (endpoint) => endpoint.kind === 'cvOutput',
                      ),
                )
                .map((module) => (
                  <option key={module.id} value={module.id}>
                    M{String(module.moduleId).padStart(2, '0')} · {module.name}
                  </option>
                ))}
            </select>
          </label>
          <div
            className={`compile-readout is-${compilationStatus}`}
            role="status"
            aria-live="polite"
          >
            {compilationStatus === 'pending' ? (
              <LoaderCircle className="is-spinning" size={15} />
            ) : null}
            {compilationStatus === 'valid' ? <CheckCircle2 size={15} /> : null}
            {compilationStatus === 'invalid' ? (
              <TriangleAlert size={15} />
            ) : null}
            <span>
              {!codecConsent
                ? 'Codec acknowledgement required'
                : compilationStatus === 'pending'
                  ? `Validating revision ${draftRevision}`
                  : compilationStatus === 'valid'
                    ? `Revision ${draftRevision} ready`
                    : compilationStatus === 'invalid'
                      ? 'Export blocked'
                      : 'Awaiting validation'}
            </span>
            <small>
              {editCount}{' '}
              {patchDraft
                ? `INSERTED ${editCount === 1 ? 'MODULE' : 'MODULES'}`
                : `PARAMETER ${editCount === 1 ? 'EDIT' : 'EDITS'}`}
            </small>
          </div>
          <button
            className="version-history-button"
            type="button"
            onClick={() => {
              selectModule(null)
              setIsVersionInspectorOpen((open) => !open)
            }}
            aria-expanded={isVersionInspectorOpen}
          >
            <FileClock size={16} /> History
            {patchHistory.length ? <span>{patchHistory.length}</span> : null}
          </button>
          <button
            className="save-document-button"
            type="button"
            onClick={() => setIsSaveVersionOpen(true)}
          >
            <FileJson size={16} /> Save version
          </button>
          <button
            className="export-button"
            type="button"
            onClick={() => void exportBinary()}
            disabled={
              isExporting ||
              (codecConsent && compilationStatus === 'pending') ||
              validationErrors.length > 0
            }
          >
            {isExporting ? (
              <LoaderCircle className="is-spinning" size={16} />
            ) : (
              <Download size={16} />
            )}
            {isExporting ? 'Compiling…' : 'Export .bin'}
          </button>
        </section>
      ) : null}

      {importError ? (
        <div className="error-strip" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>
            <strong>Workbench interrupted.</strong> {importError}
          </span>
          <button type="button" onClick={() => setImportError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {showValidation ? (
        <section
          className="validation-tray"
          aria-label="Validation findings"
          aria-live={
            validationErrors.length || compilationError ? 'assertive' : 'polite'
          }
        >
          <strong>VALIDATION</strong>
          <div>
            {compilationError ? (
              <p>
                <TriangleAlert size={14} />
                {compilationError}
              </p>
            ) : null}
            {findings.map((finding) => (
              <p
                key={`${finding.code}-${finding.moduleId ?? 'patch'}-${finding.parameterName ?? ''}`}
                className={`is-${finding.severity}`}
              >
                {finding.severity === 'error' ? (
                  <TriangleAlert size={14} />
                ) : (
                  <Radio size={14} />
                )}
                {finding.message}
              </p>
            ))}
          </div>
          <button
            className="validation-tray__dismiss"
            type="button"
            onClick={() => setDismissedValidationKey(validationKey)}
            aria-label="Dismiss validation findings"
          >
            <X size={15} />
          </button>
        </section>
      ) : null}

      <section
        className={`scope-frame ${patch ? 'has-patch' : ''}`}
        aria-label="Patch signal-flow workspace"
      >
        <div className="scope-labels" aria-hidden="true">
          <span>0</span>
          <span>2</span>
          <span>4</span>
          <span>6</span>
          <span>8</span>
          <span>10 DIV</span>
        </div>

        {patch && graph ? (
          <ReactFlow
            nodes={flowNodes}
            edges={displayedEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={onNodeClick}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onConnect={onConnect}
            onReconnect={onReconnect}
            isValidConnection={isValidConnection}
            onPaneClick={() => {
              selectModule(null)
              setSelectedConnectionId(null)
              setInspectedConnectionId(null)
            }}
            fitView
            fitViewOptions={{ padding: 0.2, minZoom: 0.72, maxZoom: 1.05 }}
            minZoom={0.25}
            maxZoom={1.8}
            nodesDraggable={hasAuthoring}
            nodesConnectable={canConnectEndpoints}
            edgesReconnectable={canConnectEndpoints}
            reconnectRadius={18}
            connectionRadius={24}
            elementsSelectable
            aria-label={`Audio signal flow for ${patch.name}`}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              color={theme === 'light' ? '#bfd1bf' : '#27452f'}
              gap={30}
              size={1}
              variant={BackgroundVariant.Lines}
            />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
        ) : (
          <div className="empty-state">
            <div className="empty-trace" aria-hidden="true">
              <svg viewBox="0 0 600 160" role="presentation">
                <path d="M0 80 H108 C118 80 119 30 132 30 C145 30 146 130 159 130 C172 130 173 58 186 58 C199 58 200 91 213 91 C226 91 227 74 240 74 H600" />
              </svg>
            </div>
            <div className="empty-state__content">
              <h1>
                See the signal.
                <br />
                Shape the patch.
              </h1>
              <p>
                Open an existing ZOIA patch as a readable logical graph, or
                author a portable Patch Document from mono signal chain to
                advanced stereo, CV, and MIDI-controlled routing.
              </p>
              <div className="empty-actions">
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => setIsNewPatchOpen(true)}
                  disabled={isCatalogLoading}
                >
                  <FilePlus2 size={18} /> Create Patch Document
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp size={17} /> Open .bin or .zoia.json
                </button>
                {recoverableSession ? (
                  <button
                    className="tertiary-action recovery-action"
                    type="button"
                    onClick={() => {
                      restoreDraft(
                        recoverableSession.draft,
                        recoverableSession.history,
                      )
                      setRecoverableSession(null)
                    }}
                  >
                    <RotateCcw size={17} /> Recover “
                    {recoverableSession.draft.name}”
                  </button>
                ) : (
                  <button
                    className="tertiary-action"
                    type="button"
                    onClick={() => setPatch(demoPatch)}
                  >
                    <FlaskConical size={17} /> Explore demo patch
                  </button>
                )}
              </div>
              <div
                className="empty-capabilities"
                aria-label="Editor capabilities"
              >
                <div>
                  <strong>TRACE</strong>
                  <span>
                    Logical routing · decoded Hz, dB, time, and raw fallbacks
                  </span>
                </div>
                <div>
                  <strong>AUTHOR</strong>
                  <span>
                    Mono or stereo · audio, CV, MIDI control, and parameter
                    ranges
                  </span>
                </div>
                <div>
                  <strong>OWN</strong>
                  <span>
                    Portable JSON · local recovery, version history, and binary
                    export
                  </span>
                </div>
              </div>
              <small className="empty-trust">
                PATCH DOCUMENTS STAY LOCAL · BINARY CODEC TRANSIENT · ORIGINALS
                UNTOUCHED
              </small>
              <button
                className="privacy-link"
                type="button"
                onClick={() => setIsPrivacyOpen(true)}
              >
                Privacy &amp; licenses
              </button>
            </div>
          </div>
        )}

        {patch ? (
          <footer className="scope-footer">
            <span>CH A · AUDIO</span>
            <span>{patch.stats.moduleCount} MODULES</span>
            <span>{patch.stats.audioConnectionCount} CONNECTIONS</span>
            <span>{patch.stats.pageCount} PAGES</span>
          </footer>
        ) : null}
      </section>

      <PatchStorageBrowser
        currentPatchName={patch?.name ?? null}
        isOpen={isPatchStorageOpen}
        onClose={() => setIsPatchStorageOpen(false)}
        onImport={(file, patchStoragePatch) => {
          void loadFile(file, patchStoragePatch)
        }}
      />

      {patch && isVersionInspectorOpen ? (
        <VersionInspector
          history={patchHistory}
          onClose={() => setIsVersionInspectorOpen(false)}
          onImport={() => versionFileInputRef.current?.click()}
          onRestore={restorePatchVersion}
        />
      ) : null}

      {patch && selectedModuleId ? (
        <ModuleInspector
          patch={patch}
          patchDocument={patchDocument}
          moduleId={selectedModuleId}
          parameterEdits={parameterEdits}
          moduleCatalog={moduleCatalog}
          canEdit={hasAuthoring}
          canRename={isFreeAuthoring}
          canColorize={hasAuthoring}
          canRemove={Boolean(
            (patchDraft &&
              !patchDraft.modules
                .find((module) => module.id === selectedModuleId)
                ?.catalogId.startsWith('audio-')) ||
            (isFreeAuthoring &&
              !patchDocument.modules
                .find((module) => module.id === selectedModuleId)
                ?.configurationId?.startsWith('audio-')),
          )}
          onBeginParameterGesture={beginParameterGesture}
          onChangeParameter={updateParameter}
          onCommitParameterGesture={commitParameterGesture}
          onRename={(name) => renameModule(selectedModuleId, name)}
          onChangeColor={(colorId) => setModuleColor(selectedModuleId, colorId)}
          onChangeExperimentalOption={async (
            configuration,
            optionKey,
            optionIndex,
          ) => {
            if (!configuration.codec) return
            try {
              const resolved = await resolveExperimentalModuleCatalogEntry({
                moduleIndex: configuration.codec.moduleIndex,
                optionIndices: {
                  ...configuration.codec.optionIndices,
                  [optionKey]: optionIndex,
                },
              })
              setModuleConfiguration(selectedModuleId, resolved)
            } catch (error) {
              setImportError(
                error instanceof Error
                  ? error.message
                  : 'The Module Configuration option could not be changed.',
              )
            }
          }}
          onCreateControlMapping={createControlMapping}
          onSetControlMappingRange={setControlMappingRange}
          onSetConnectionStrength={setConnectionStrength}
          onSetSourceCalibration={setSourceCalibration}
          onRemoveConnection={removeConnection}
          onRemove={() => removeModule(selectedModuleId)}
          onClose={() => selectModule(null)}
        />
      ) : null}

      {patchDocument && inspectedConnectionId
        ? (() => {
            const connection = patchDocument.connections.find(
              (candidate) => candidate.id === inspectedConnectionId,
            )
            if (!connection) return null
            return (
              <ConnectionInspector
                key={`${connection.id}-${connection.strengthRaw}`}
                document={patchDocument}
                connection={connection}
                canEdit={hasAuthoring}
                sourceFullScaleValue={sourceCalibrationFullScaleValue(
                  patchDocument,
                  connection.sourceModuleId,
                  connection.sourceEndpointId,
                )}
                onSetRange={setControlMappingRange}
                onSetStrength={setConnectionStrength}
                onSetSourceCalibration={setSourceCalibration}
                onRemove={(connectionId) => {
                  removeConnection(connectionId)
                  setSelectedConnectionId(null)
                  setInspectedConnectionId(null)
                }}
                onClose={() => {
                  setSelectedConnectionId(null)
                  setInspectedConnectionId(null)
                }}
              />
            )
          })()
        : null}

      {isLibraryOpen && (patchDraft || isFreeAuthoring) ? (
        <aside className="module-library" aria-label="Module library">
          <header>
            <div>
              <h2>
                {isFreeAuthoring ? 'Add a module' : 'Insert into the signal'}
              </h2>
              <p>
                {isFreeAuthoring
                  ? 'Choose a configuration, then connect its endpoints.'
                  : 'One choice rewires both sides automatically.'}
              </p>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setIsLibraryOpen(false)}
              aria-label="Close Module library"
            >
              <X size={18} />
            </button>
          </header>
          {patchDraft ? (
            <label className="connection-picker">
              <span>CONNECTION</span>
              <select
                value={insertionConnectionId}
                onChange={(event) =>
                  setInsertionConnectionId(event.target.value)
                }
              >
                {patchDraft.connections.map((connection) => {
                  const source = patchDraft.modules.find(
                    (module) => module.id === connection.sourceModuleId,
                  )?.name
                  const target = patchDraft.modules.find(
                    (module) => module.id === connection.targetModuleId,
                  )?.name
                  return (
                    <option key={connection.id} value={connection.id}>
                      {source} → {target}
                    </option>
                  )
                })}
              </select>
            </label>
          ) : null}
          <label className="module-search">
            <Search size={16} aria-hidden="true" />
            <input
              autoFocus
              type="search"
              value={libraryQuery}
              onChange={(event) => setLibraryQuery(event.target.value)}
              placeholder="Filter gain, delay, reverb…"
              aria-label="Filter Module library"
            />
          </label>
          <div className="module-catalog-list">
            {groupedCatalog.map((group) => (
              <article className="module-catalog-group" key={group.id}>
                <span>
                  <strong>{group.name}</strong>
                  <small>{group.category}</small>
                </span>
                <p>{group.description}</p>
                <div className="module-catalog-group__variants">
                  {group.variants.map(({ configuration, label }) => (
                    <button
                      key={configuration.id}
                      type="button"
                      aria-label={`Add ${group.name} ${label}`}
                      title={`${configuration.cpu.toFixed(1)}% CPU estimate`}
                      onClick={() => {
                        if (isFreeAuthoring) addModule(configuration.id)
                        else
                          insertModule(insertionConnectionId, configuration.id)
                        setIsLibraryOpen(false)
                      }}
                    >
                      <Plus size={14} aria-hidden="true" />
                      <span>{label}</span>
                      <small>{configuration.cpu.toFixed(1)}%</small>
                      {configuration.options?.length ? (
                        <span className="module-catalog-parameters">
                          {[
                            ...configuration.parameters.map(
                              (parameter) => parameter.name,
                            ),
                            ...(configuration.options ?? []).map(
                              (option) =>
                                `${option.name}: ${option.values.join('/')}`,
                            ),
                          ].join(' · ') ||
                            'No parameters or options in this configuration'}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </article>
            ))}
            {!groupedCatalog.length ? (
              <p className="library-empty">
                No configured Modules match “{libraryQuery}”.
              </p>
            ) : null}
          </div>
          <footer>TEST EXPORTS ON YOUR HARDWARE BEFORE PERFORMANCE USE</footer>
        </aside>
      ) : null}

      {isReportOpen ? (
        <div
          className="dialog-scrim"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setIsReportOpen(false)
          }}
        >
          <form
            className="new-patch-dialog report-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            onSubmit={(event) => {
              event.preventDefault()
              window.open(reportUrl, '_blank', 'noopener,noreferrer')
              setIsReportOpen(false)
            }}
          >
            <header>
              <Bug size={22} />
              <h2 id="report-title">Report issue</h2>
            </header>
            <p>
              GitHub will open in a new tab. Its issue and any Patch Document
              you attach will be public.
            </p>
            <label>
              <span>REPORT TYPE</span>
              <select
                value={reportKind}
                onChange={(event) =>
                  setReportKind(event.target.value as 'app' | 'module')
                }
              >
                <option value="app">App issue</option>
                <option value="module">Module compatibility</option>
              </select>
            </label>
            {reportKind === 'module' ? (
              <>
                <label>
                  <span>MODULE</span>
                  <select
                    required
                    value={reportModuleId}
                    onChange={(event) => setReportModuleId(event.target.value)}
                  >
                    <option value="">Choose Module…</option>
                    {patchDocument?.modules.map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.name} · {module.configurationId ?? module.type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>HARDWARE</span>
                  <select
                    value={reportHardware}
                    onChange={(event) => setReportHardware(event.target.value)}
                  >
                    <option>ZOIA Pedal</option>
                    <option>Euroburo</option>
                  </select>
                </label>
                <label>
                  <span>FIRMWARE VERSION</span>
                  <input
                    required
                    value={reportFirmware}
                    onChange={(event) => setReportFirmware(event.target.value)}
                  />
                </label>
                <label>
                  <span>EXPECTED BEHAVIOR</span>
                  <textarea
                    required
                    rows={3}
                    value={reportExpected}
                    onChange={(event) => setReportExpected(event.target.value)}
                  />
                </label>
                <label>
                  <span>ACTUAL BEHAVIOR</span>
                  <textarea
                    required
                    rows={3}
                    value={reportActual}
                    onChange={(event) => setReportActual(event.target.value)}
                  />
                </label>
              </>
            ) : (
              <label>
                <span>WHAT HAPPENED?</span>
                <textarea
                  required
                  rows={4}
                  value={reportDescription}
                  onChange={(event) => setReportDescription(event.target.value)}
                />
              </label>
            )}
            {patchDocument ? (
              <p className="dialog-warning">
                Patch summary: {patchDocument.modules.length} Modules ·{' '}
                {patchDocument.connections.length} Connections · SHA-256{' '}
                {patchHash || 'calculating…'}
              </p>
            ) : null}
            <details className="report-preview">
              <summary>Preview public GitHub issue</summary>
              <pre>{new URL(reportUrl).searchParams.get('body')}</pre>
            </details>
            <div>
              <button
                className="dialog-cancel"
                type="button"
                onClick={() => setIsReportOpen(false)}
              >
                Cancel
              </button>
              <button
                className="dialog-create"
                type="submit"
                disabled={reportKind === 'module' && !patchDocument}
              >
                <Bug size={16} /> Open GitHub issue
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isCodecDisclosureOpen ? (
        <div
          className="dialog-scrim"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setPendingCodecFile(null)
              setPendingPatchStoragePatch(null)
              setIsCodecDisclosureOpen(false)
            }
          }}
        >
          <section
            className="new-patch-dialog codec-disclosure"
            role="dialog"
            aria-modal="true"
            aria-labelledby="codec-disclosure-title"
          >
            <header>
              <Radio size={22} />
              <h2 id="codec-disclosure-title">Use the Hosted Codec?</h2>
            </header>
            <p>
              Binary import, validation, and export send ZOIA data securely to
              zoia.eimerreis.de. The codec processes it in memory and does not
              retain it. Patch Documents, recovery, and Patch History remain in
              this browser.
            </p>
            <ul>
              <li>Maximum binary size: 1 MiB</li>
              <li>No account or server-side Patch library</li>
              <li>
                You can continue JSON authoring if the codec is unavailable
              </li>
            </ul>
            <p className="codec-disclosure__links">
              <button
                type="button"
                onClick={() => {
                  setIsCodecDisclosureOpen(false)
                  setIsPrivacyOpen(true)
                }}
              >
                Read privacy &amp; license details
              </button>
            </p>
            <div>
              <button
                className="dialog-cancel"
                type="button"
                onClick={() => {
                  setPendingCodecFile(null)
                  setPendingPatchStoragePatch(null)
                  setIsCodecDisclosureOpen(false)
                }}
              >
                Not now
              </button>
              <button
                className="dialog-create"
                type="button"
                onClick={acceptCodecDisclosure}
              >
                <CheckCircle2 size={16} /> Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isPrivacyOpen ? (
        <div
          className="dialog-scrim"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setIsPrivacyOpen(false)
              if (pendingCodecFile) setIsCodecDisclosureOpen(true)
            }
          }}
        >
          <section
            className="new-patch-dialog privacy-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-title"
          >
            <header>
              <FileJson size={22} />
              <h2 id="privacy-title">Privacy &amp; licenses</h2>
            </header>
            <h3>Your Local Workspace</h3>
            <p>
              Patch Documents, recovery snapshots, Patch History, and theme
              preferences are stored in this browser. They are not synchronized
              to an account or server.
            </p>
            <h3>Binary processing</h3>
            <p>
              Binary imports and exports are sent over HTTPS to the stateless
              Hosted Codec, processed in memory, and discarded after the
              response. The service does not intentionally retain Patch data.
              Infrastructure may record standard request metadata such as time,
              route, status, and network address for security and operation.
            </p>
            <h3>Open-source software</h3>
            <p>
              ZOIA / SCOPE and its Hosted Codec are licensed under GPL-3.0. The
              codec includes meanmedianmoge/zoia_lib at the pinned revision
              documented in the public source repository.
            </p>
            <div>
              <a
                className="dialog-source-link"
                href="https://github.com/EimerReis-Enterprise/zoia-editor"
                target="_blank"
                rel="noreferrer"
              >
                View source
              </a>
              <button
                className="dialog-create"
                type="button"
                onClick={() => {
                  setIsPrivacyOpen(false)
                  if (pendingCodecFile) setIsCodecDisclosureOpen(true)
                }}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isSaveVersionOpen ? (
        <div
          className="dialog-scrim"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !isSavingVersion) {
              setIsSaveVersionOpen(false)
            }
          }}
        >
          <form
            className="new-patch-dialog save-version-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-version-title"
            onSubmit={(event) => void submitSaveVersion(event)}
          >
            <header>
              <FileClock size={22} />
              <h2 id="save-version-title">
                Save v
                {String(
                  Math.max(
                    patchVersionMetadata(patchDocument!)?.version ?? 0,
                    ...patchHistory.map((version) => version.metadata.version),
                    0,
                  ) + 1,
                ).padStart(3, '0')}
              </h2>
            </header>
            <p>
              Record what changed. This version stays in local Patch History and
              downloads as a portable Patch Document.
            </p>
            <label>
              <span>VERSION SUMMARY · 120 CHARACTERS</span>
              <input
                autoFocus
                required
                maxLength={120}
                value={versionMessage}
                placeholder="More decay and a slower wash"
                onChange={(event) => setVersionMessage(event.target.value)}
              />
            </label>
            <div>
              <button
                className="dialog-cancel"
                type="button"
                disabled={isSavingVersion}
                onClick={() => setIsSaveVersionOpen(false)}
              >
                Cancel
              </button>
              <button
                className="dialog-create"
                type="submit"
                disabled={isSavingVersion || !versionMessage.trim()}
              >
                {isSavingVersion ? (
                  <LoaderCircle className="is-spinning" size={16} />
                ) : (
                  <Download size={16} />
                )}
                {isSavingVersion ? 'Saving…' : 'Save and download'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isNewPatchOpen ? (
        <div
          className="dialog-scrim"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setIsNewPatchOpen(false)
          }}
        >
          <form
            className="new-patch-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-patch-title"
            onSubmit={submitNewPatch}
          >
            <header>
              <FilePlus2 size={22} />
              <h2 id="new-patch-title">New Patch Document</h2>
            </header>
            <p>
              {newPatchMode === 'linear'
                ? 'Start with a mono patch.'
                : 'Start with a stereo patch.'}
            </p>
            {patch ? (
              <p className="dialog-warning">
                <TriangleAlert size={15} />
                This replaces the current in-session workbench.
              </p>
            ) : null}
            <label>
              <span>PATCH FORMAT</span>
              <select
                value={newPatchMode}
                onChange={(event) =>
                  setNewPatchMode(event.target.value as 'linear' | 'free')
                }
              >
                <option value="linear">Mono</option>
                <option value="free">Stereo</option>
              </select>
            </label>
            <label>
              <span>PATCH NAME · 16 CHARACTERS</span>
              <input
                autoFocus
                value={newPatchName}
                maxLength={16}
                pattern="[ -~]+"
                required
                onChange={(event) => setNewPatchName(event.target.value)}
              />
            </label>
            <div>
              <button
                className="dialog-cancel"
                type="button"
                onClick={() => setIsNewPatchOpen(false)}
              >
                Cancel
              </button>
              <button className="dialog-create" type="submit">
                <Radio size={16} /> Create document
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isConnectionOpen ? (
        <div
          className="dialog-scrim"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setIsConnectionOpen(false)
          }}
        >
          <form
            className="new-patch-dialog connection-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connection-dialog-title"
            onSubmit={submitConnection}
          >
            <header>
              <Cable size={22} />
              <h2 id="connection-dialog-title">Connect endpoints</h2>
            </header>
            <p>
              Create explicit audio or control Connections. Incompatible
              endpoint kinds are rejected.
            </p>
            {patchDocument?.connections.length ? (
              <div className="connection-dialog__existing">
                <strong>EXISTING CONNECTIONS</strong>
                {patchDocument.connections.map((connection) => (
                  <div key={connection.id}>
                    <span>
                      {
                        patchDocument.modules.find(
                          (module) => module.id === connection.sourceModuleId,
                        )?.name
                      }{' '}
                      · {connection.sourceEndpoint} →{' '}
                      {
                        patchDocument.modules.find(
                          (module) => module.id === connection.targetModuleId,
                        )?.name
                      }{' '}
                      · {connection.targetEndpoint}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeConnection(connection.id)}
                      aria-label={`Remove Connection ${connection.sourceEndpoint} to ${connection.targetEndpoint}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <label>
              <span>SOURCE OUTPUT</span>
              <select
                required
                value={sourceEndpointValue}
                onChange={(event) => setSourceEndpointValue(event.target.value)}
              >
                {sourceEndpoints.map((endpoint) => (
                  <option key={endpoint.value} value={endpoint.value}>
                    {endpoint.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>TARGET INPUT</span>
              <select
                required
                value={targetEndpointValue}
                onChange={(event) => setTargetEndpointValue(event.target.value)}
              >
                {targetEndpoints.map((endpoint) => (
                  <option key={endpoint.value} value={endpoint.value}>
                    {endpoint.label}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button
                className="dialog-cancel"
                type="button"
                onClick={() => setIsConnectionOpen(false)}
              >
                Cancel
              </button>
              <button className="dialog-create" type="submit">
                <Cable size={16} /> Connect
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {toast ? (
        <div className={`validation-toast is-${toast.tone}`} role="alert">
          <TriangleAlert size={17} />
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={clearToast}
            aria-label="Dismiss validation message"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
    </main>
  )
}
