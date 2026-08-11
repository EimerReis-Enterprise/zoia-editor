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
  Cable,
  CheckCircle2,
  Download,
  FileJson,
  FilePlus2,
  FileUp,
  FlaskConical,
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
  canReorderDraftModules,
  compilePatchDocument,
  filterModuleCatalog,
  getModuleCatalog,
  groupModuleCatalog,
  importPatchDocument,
  loadPatchDraftSession,
  resolveExperimentalModuleCatalogEntry,
  savePatchDraftSession,
  serializePatchDocument,
} from '#/lib/domain/patch'
import type { PatchDraftSession } from '#/lib/domain/patch'

import { demoPatch } from './demo-patch'
import { layoutPatch } from './graph-layout'
import { ModuleInspector } from './module-inspector'
import { ModuleNode } from './module-node'
import { nodeDropTarget } from './node-reorder'
import { SignalEdge } from './signal-edge'
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
  const [isExporting, setIsExporting] = useState(false)
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
  const [dragTargetConnectionId, setDragTargetConnectionId] = useState<
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
    experimentalMode,
    hardwareTarget,
    firmwareVersion,
    verifiedBy,
    setExperimentalMode,
    setHardwareProfile,
    setPatch,
    setPatchDocument,
    setModuleCatalog,
    createDraft,
    createAdvancedDocument,
    restoreDraft,
    insertModule,
    addModule,
    connectEndpoints,
    createControlMapping,
    setControlMappingRange,
    setSourceCalibration,
    removeConnection,
    renameModule,
    setModuleColor,
    setModuleConfiguration,
    removeModule,
    reorderModules,
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
  const hasAuthoring = Boolean(patchDocument)
  const isFreeAuthoring = patchDocument?.authoringMode === 'free'
  const canEditConnections = Boolean(patchDraft)
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
            canEditConnections,
            onInsertConnection: openModuleLibraryForConnection,
          })
        : null,
    [canEditConnections, openModuleLibraryForConnection, patch, signalColor],
  )
  const displayedEdges = useMemo(
    () =>
      graph?.edges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          isDropTarget: edge.id === dragTargetConnectionId,
        },
      })) ?? [],
    [dragTargetConnectionId, graph],
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
        experimentalMode,
      ),
    [experimentalMode, isFreeAuthoring, libraryQuery, moduleCatalog],
  )
  const groupedCatalog = useMemo(
    () => groupModuleCatalog(filteredCatalog),
    [filteredCatalog],
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    void loadPatchDraftSession()
      .then(setRecoverableSession)
      .catch(() => setRecoverableSession(null))
  }, [])

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
    if (!patchDocument) return
    const controller = new AbortController()
    const revision = draftRevision
    setCompilationPending(revision)
    const timeout = window.setTimeout(() => {
      void compilePatchDocument(
        { document: patchDocument, patchRevision: revision },
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
    draftRevision,
    patchDocument,
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
  }, [redo, undo])

  const loadFile = async (file: File | undefined) => {
    if (!file) return
    setImportError(null)
    setImporting(true)
    try {
      setPatchDocument(await importPatchDocument(file))
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

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    void loadFile(event.dataTransfer.files[0])
  }

  const onNodeClick: NodeMouseHandler = (_event, node) => selectModule(node.id)
  const findNodeDropTarget = useCallback(
    (node: Node) => {
      if (!patchDraft || !graph) return null
      const centerXByModuleId = Object.fromEntries(
        graph.nodes.map((graphNode) => [
          graphNode.id,
          graphNode.position.x +
            (graphNode.measured?.width ?? graphNode.width ?? 188) / 2,
        ]),
      )
      return nodeDropTarget(
        patchDraft.modules.map((module) => module.id),
        centerXByModuleId,
        node.id,
        node.position.x + (node.measured?.width ?? node.width ?? 188) / 2,
      )
    },
    [graph, patchDraft],
  )
  const onNodeDragStart: OnNodeDrag = () => {
    selectModule(null)
    setIsLibraryOpen(false)
  }
  const onNodeDrag: OnNodeDrag = (_event, node) => {
    const target = findNodeDropTarget(node)
    const connection = target
      ? patchDraft?.connections.find(
          (candidate) =>
            candidate.sourceModuleId === target.afterModuleId &&
            candidate.targetModuleId === target.beforeModuleId,
        )
      : null
    setDragTargetConnectionId(connection?.id ?? null)
  }
  const onNodeDragStop: OnNodeDrag = (_event, node) => {
    const target = findNodeDropTarget(node)
    setDragTargetConnectionId(null)
    if (target) {
      reorderModules(target.afterModuleId, node.id)
    } else if (graph) {
      setFlowNodes(graph.nodes)
    }
  }
  const onEdgeClick: EdgeMouseHandler = (_event, edge) => {
    if (!patchDraft) return
    openModuleLibraryForConnection(edge.id)
  }
  const isValidConnection: IsValidConnection = useCallback(
    (connection) =>
      Boolean(
        patchDraft &&
        canReorderDraftModules(
          patchDraft,
          connection.source,
          connection.target,
        ),
      ),
    [patchDraft],
  )
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!patchDraft || !isValidConnection(connection)) return
      reorderModules(connection.source, connection.target)
    },
    [isValidConnection, patchDraft, reorderModules],
  )
  const onReconnect: OnReconnect = useCallback(
    (_edge, connection) => {
      if (!patchDraft || !isValidConnection(connection)) return
      reorderModules(connection.source, connection.target)
    },
    [isValidConnection, patchDraft, reorderModules],
  )

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

  const saveDocument = () => {
    const currentDocument = useWorkbenchStore.getState().patchDocument
    if (!currentDocument) return
    const blob = new Blob([serializePatchDocument(currentDocument)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const safeName =
      currentDocument.name.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'patch'
    link.download = `${safeName}.zoia.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportBinary = async () => {
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
    ? pastDrafts.length > 0
    : pastEdits.length > 0 || pastDocuments.length > 0
  const canRedo = patchDraft
    ? futureDrafts.length > 0
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
        <div className="brand-lockup" aria-label="ZOIA Patch Visualizer">
          <span className="brand-mark" aria-hidden="true">
            <Radio size={22} />
          </span>
          <div>
            <strong>ZOIA / SCOPE</strong>
            <span>Logical patch analyzer</span>
          </div>
        </div>

        {patch ? (
          <div className="patch-readout" aria-label="Loaded patch">
            <span>{patchDocument ? 'PATCH DOCUMENT' : 'PATCH ACQUIRED'}</span>
            <strong>{patch.name}</strong>
            <small>
              {patchDraft
                ? `MONO · ${isDraftSaved ? 'RECOVERY SAVED' : 'SAVING RECOVERY'} · EXPERIMENTAL`
                : patch.sourceFilename}
            </small>
          </div>
        ) : (
          <div className="patch-readout is-idle">
            <span>CHANNEL A</span>
            <strong>NO PATCH</strong>
            <small>Waiting for local input</small>
          </div>
        )}

        <div className="instrument-actions">
          <span
            className={`status-light ${patch ? 'is-armed' : ''}`}
            aria-hidden="true"
          />
          <span className="status-copy">
            {isImporting
              ? 'DECODING'
              : patchDocument
                ? 'DOCUMENT READY'
                : patch
                  ? 'SIGNAL LOCKED'
                  : 'STANDBY'}
          </span>
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            className="instrument-button is-secondary"
            type="button"
            onClick={() => setIsNewPatchOpen(true)}
            disabled={isCatalogLoading}
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
          >
            {isImporting ? (
              <RotateCcw className="is-spinning" size={17} />
            ) : (
              <FileUp size={17} />
            )}
            {isImporting ? 'Acquiring…' : 'Import patch'}
          </button>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".bin,.json,application/json,application/octet-stream"
            onChange={onFileChange}
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
          {isFreeAuthoring ? (
            <div className="experimental-controls">
              <label className="experimental-toggle">
                <input
                  type="checkbox"
                  checked={experimentalMode}
                  onChange={(event) => setExperimentalMode(event.target.checked)}
                />
                Experimental
              </label>
              {experimentalMode ? (
                <div className="hardware-profile" aria-label="Hardware verification profile">
                  <select
                    aria-label="Hardware target"
                    value={hardwareTarget}
                    onChange={(event) =>
                      setHardwareProfile({
                        hardwareTarget: event.target.value as 'zoia-pedal' | 'euroburo',
                      })
                    }
                  >
                    <option value="zoia-pedal">ZOIA Pedal</option>
                    <option value="euroburo">Euroburo</option>
                  </select>
                  <input
                    aria-label="Firmware version"
                    placeholder="Firmware"
                    value={firmwareVersion}
                    onChange={(event) =>
                      setHardwareProfile({ firmwareVersion: event.target.value })
                    }
                  />
                  <input
                    aria-label="Verifier name"
                    placeholder="Verifier"
                    value={verifiedBy}
                    onChange={(event) =>
                      setHardwareProfile({ verifiedBy: event.target.value })
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}
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
              {compilationStatus === 'pending'
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
            className="save-document-button"
            type="button"
            onClick={saveDocument}
          >
            <FileJson size={16} /> Save .zoia.json
          </button>
          <button
            className="export-button"
            type="button"
            onClick={() => void exportBinary()}
            disabled={
              isExporting ||
              compilationStatus === 'pending' ||
              validationErrors.length > 0
            }
          >
            {isExporting ? (
              <LoaderCircle className="is-spinning" size={16} />
            ) : (
              <Download size={16} />
            )}
            {isExporting
              ? 'Compiling…'
              : patchDraft
                ? 'Export experimental .bin'
                : 'Export test .bin'}
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
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onEdgeClick={onEdgeClick}
            onConnect={onConnect}
            onReconnect={onReconnect}
            isValidConnection={isValidConnection}
            onPaneClick={() => selectModule(null)}
            fitView
            fitViewOptions={{ padding: 0.2, minZoom: 0.72, maxZoom: 1.05 }}
            minZoom={0.25}
            maxZoom={1.8}
            nodesDraggable={canEditConnections}
            nodesConnectable={canEditConnections}
            edgesReconnectable={canEditConnections}
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
                Start with signal.
                <br />
                Build the patch.
              </h1>
              <p>
                Create a prewired mono Signal Chain, insert audio Modules
                directly into its path, tune exact parameters, and export an
                experimental ZOIA binary.
              </p>
              <div className="empty-actions">
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => setIsNewPatchOpen(true)}
                  disabled={isCatalogLoading}
                >
                  <FilePlus2 size={18} /> New mono patch
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp size={17} /> Import .bin or .json
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
                    <FlaskConical size={17} /> Inspect demo
                  </button>
                )}
              </div>
              <small>
                LOCAL ONLY · HARDWARE UNVERIFIED · ORIGINAL FILES UNTOUCHED
              </small>
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
          experimentalMode={experimentalMode}
          hardwareTarget={hardwareTarget}
          firmwareVersion={firmwareVersion}
          verifiedBy={verifiedBy}
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
                  : 'The Experimental option could not be changed.',
              )
            }
          }}
          onCreateControlMapping={createControlMapping}
          onSetControlMappingRange={setControlMappingRange}
          onSetSourceCalibration={setSourceCalibration}
          onRemoveConnection={removeConnection}
          onRemove={() => removeModule(selectedModuleId)}
          onClose={() => selectModule(null)}
        />
      ) : null}

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
                      <small>
                        {configuration.experimental
                          ? 'EXPERIMENTAL'
                          : `${configuration.cpu.toFixed(1)}%`}
                      </small>
                      {configuration.experimental ? (
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
          <footer>
            CONFIGURATIONS ARE EXPERIMENTAL UNTIL VERIFIED ON HARDWARE
          </footer>
        </aside>
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
                ? 'Begin with Left Audio Input wired directly to Left Audio Output. Every Module stays in one safe linear Signal Chain.'
                : 'Begin with stereo I/O and use explicit endpoint Connections for audio, CV, clock, and MIDI control.'}
            </p>
            {patch ? (
              <p className="dialog-warning">
                <TriangleAlert size={15} />
                This replaces the current in-session workbench.
              </p>
            ) : null}
            <label>
              <span>AUTHORING MODE</span>
              <select
                value={newPatchMode}
                onChange={(event) =>
                  setNewPatchMode(event.target.value as 'linear' | 'free')
                }
              >
                <option value="linear">Safe mono Signal Chain</option>
                <option value="free">Advanced stereo routing</option>
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
