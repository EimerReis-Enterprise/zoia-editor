import {
  ArrowLeft,
  ArrowRight,
  Globe2,
  LoaderCircle,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  downloadPatchStorageBinary,
  getPatchStoragePatch,
  getPatchStoragePatches,
  patchStorageCompatibility,
} from '#/lib/domain/patch-storage'
import type {
  PatchStoragePatchDetail,
  PatchStoragePatchPage,
  PatchStorageSort,
} from '#/lib/domain/patch-storage'

import {
  PatchStorageDetail,
  PatchStorageMetrics,
  readablePatchStorageDate,
} from './patch-storage-browser-presentation'

const PAGE_SIZE = 25
const SORT_OPTIONS: { value: PatchStorageSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'likes', label: 'Most liked' },
  { value: 'views', label: 'Most viewed' },
]

const fullNumber = new Intl.NumberFormat()

type PatchStorageBrowserProps = {
  currentPatchName: string | null
  isOpen: boolean
  onClose: () => void
  onImport: (file: File, patch: PatchStoragePatchDetail) => void
}

export function PatchStorageBrowser({
  currentPatchName,
  isOpen,
  onClose,
  onImport,
}: PatchStorageBrowserProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const confirmationCancelRef = useRef<HTMLButtonElement>(null)
  const detailCache = useRef(new Map<number, PatchStoragePatchDetail>())
  const openAbortController = useRef<AbortController | null>(null)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<PatchStorageSort>('newest')
  const [page, setPage] = useState(1)
  const [patchPage, setPatchPage] = useState<PatchStoragePatchPage | null>(null)
  const [selectedPatchId, setSelectedPatchId] = useState<number | null>(null)
  const [selectedPatch, setSelectedPatch] =
    useState<PatchStoragePatchDetail | null>(null)
  const [isListLoading, setIsListLoading] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [listRequest, setListRequest] = useState(0)
  const [detailRequest, setDetailRequest] = useState(0)
  const [openError, setOpenError] = useState<string | null>(null)
  const [isConfirmingOpen, setIsConfirmingOpen] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement
    if (!window.matchMedia('(min-width: 821px)').matches)
      setSelectedPatchId(null)
    const frame = window.requestAnimationFrame(() =>
      searchInputRef.current?.focus(),
    )
    return () => {
      window.cancelAnimationFrame(frame)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isConfirmingOpen) setIsConfirmingOpen(false)
      else if (!isOpening) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isConfirmingOpen, isOpen, isOpening, onClose])

  useEffect(() => {
    if (isConfirmingOpen) confirmationCancelRef.current?.focus()
  }, [isConfirmingOpen])

  useEffect(
    () => () => {
      openAbortController.current?.abort()
    },
    [],
  )

  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()
    setIsListLoading(true)
    setListError(null)
    void getPatchStoragePatches(
      { page, pageSize: PAGE_SIZE, query, sort },
      { signal: controller.signal },
    )
      .then((result) => {
        setPatchPage(result)
        setSelectedPatchId((current) => {
          if (result.items.some((patch) => patch.id === current)) return current
          return window.matchMedia('(min-width: 821px)').matches
            ? (result.items[0]?.id ?? null)
            : null
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setPatchPage(null)
        setSelectedPatchId(null)
        setListError(
          error instanceof Error
            ? error.message
            : 'PatchStorage patches could not be loaded.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsListLoading(false)
      })
    return () => controller.abort()
  }, [isOpen, listRequest, page, query, sort])

  useEffect(() => {
    if (!isOpen || selectedPatchId === null) {
      setSelectedPatch(null)
      return
    }
    const cached = detailCache.current.get(selectedPatchId)
    if (cached) {
      setSelectedPatch(cached)
      setDetailError(null)
      return
    }
    const controller = new AbortController()
    setSelectedPatch(null)
    setIsDetailLoading(true)
    setDetailError(null)
    void getPatchStoragePatch(selectedPatchId, { signal: controller.signal })
      .then((patch) => {
        detailCache.current.set(patch.id, patch)
        setSelectedPatch(patch)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setDetailError(
          error instanceof Error
            ? error.message
            : 'Patch details could not be loaded.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsDetailLoading(false)
      })
    return () => controller.abort()
  }, [detailRequest, isOpen, selectedPatchId])

  if (!isOpen) return null

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setQuery(queryInput.trim())
  }

  const requestOpen = () => {
    if (!selectedPatch || !patchStorageCompatibility(selectedPatch).openable)
      return
    if (currentPatchName) setIsConfirmingOpen(true)
    else void openSelectedPatch()
  }

  const openSelectedPatch = async () => {
    if (!selectedPatch) return
    setIsConfirmingOpen(false)
    setIsOpening(true)
    setOpenError(null)
    const controller = new AbortController()
    openAbortController.current = controller
    try {
      const file = await downloadPatchStorageBinary(selectedPatch, {
        signal: controller.signal,
      })
      onImport(file, selectedPatch)
      onClose()
    } catch (error) {
      if (controller.signal.aborted) return
      setOpenError(
        error instanceof Error
          ? error.message
          : 'The Patch could not be opened.',
      )
    } finally {
      if (!controller.signal.aborted) setIsOpening(false)
      openAbortController.current = null
    }
  }

  return (
    <div
      className="dialog-scrim patch-storage-scrim"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isOpening) onClose()
      }}
    >
      <section
        className="patch-storage-browser"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patch-storage-title"
      >
        <header className="patch-storage-browser__header">
          <div>
            <Globe2 size={21} aria-hidden="true" />
            <div>
              <h2 id="patch-storage-title">Browse PatchStorage</h2>
              <p>Community patches for ZOIA / Euroburo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isOpening}
            aria-label="Close PatchStorage browser"
          >
            <X size={18} />
          </button>
        </header>

        <form className="patch-storage-tools" onSubmit={submitSearch}>
          <label className="patch-storage-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search PatchStorage</span>
            <input
              ref={searchInputRef}
              type="search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search patches, sounds, and authors…"
            />
          </label>
          <button type="submit">Search</button>
          <label className="patch-storage-sort">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) => {
                setPage(1)
                setSort(event.target.value as PatchStorageSort)
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </form>

        <div className="patch-storage-browser__body">
          <section
            className={`patch-storage-results ${selectedPatchId ? 'has-selection' : ''}`}
            aria-label="PatchStorage results"
          >
            <div className="patch-storage-results__status" aria-live="polite">
              <span>
                {isListLoading
                  ? 'Scanning PatchStorage…'
                  : patchPage
                    ? `${fullNumber.format(patchPage.totalItems)} patches`
                    : 'PatchStorage'}
              </span>
              {query ? <strong>“{query}”</strong> : null}
            </div>

            {listError ? (
              <div className="patch-storage-state is-error" role="alert">
                <TriangleAlert size={20} />
                <strong>PatchStorage could not be loaded</strong>
                <p>{listError}</p>
                <button
                  type="button"
                  onClick={() => setListRequest((value) => value + 1)}
                >
                  Try again
                </button>
              </div>
            ) : isListLoading && !patchPage ? (
              <div className="patch-storage-state">
                <LoaderCircle className="is-spinning" size={22} />
                <strong>Loading community patches</strong>
              </div>
            ) : patchPage?.items.length ? (
              <div className="patch-storage-result-list">
                {patchPage.items.map((result) => (
                  <button
                    key={result.id}
                    className="patch-storage-result"
                    type="button"
                    aria-pressed={selectedPatchId === result.id}
                    onClick={() => {
                      setSelectedPatchId(result.id)
                      setOpenError(null)
                    }}
                  >
                    {result.artworkThumbnailUrl ? (
                      <img
                        src={result.artworkThumbnailUrl}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className="patch-storage-result__signal"
                        aria-hidden="true"
                      >
                        <Globe2 size={17} />
                      </span>
                    )}
                    <span className="patch-storage-result__copy">
                      <strong>{result.title}</strong>
                      <span>
                        {result.author.name} ·{' '}
                        {readablePatchStorageDate(result.updatedAt)}
                      </span>
                    </span>
                    <PatchStorageMetrics patch={result} />
                    <ArrowRight
                      className="patch-storage-result__arrow"
                      size={15}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="patch-storage-state">
                <Search size={22} />
                <strong>No matching patches</strong>
                <p>Try a broader title, author, or sound description.</p>
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQueryInput('')
                      setQuery('')
                      setPage(1)
                    }}
                  >
                    Clear search
                  </button>
                ) : null}
              </div>
            )}

            {patchPage && patchPage.totalPages > 1 ? (
              <nav
                className="patch-storage-pagination"
                aria-label="Patch results pages"
              >
                <button
                  type="button"
                  disabled={page <= 1 || isListLoading}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  aria-label="Previous results page"
                >
                  <ArrowLeft size={15} /> Previous
                </button>
                <span>
                  Page {patchPage.page} of {patchPage.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= patchPage.totalPages || isListLoading}
                  onClick={() =>
                    setPage((value) =>
                      Math.min(patchPage.totalPages, value + 1),
                    )
                  }
                  aria-label="Next results page"
                >
                  Next <ArrowRight size={15} />
                </button>
              </nav>
            ) : null}
          </section>

          <PatchStorageDetail
            detailError={detailError}
            isDetailLoading={isDetailLoading}
            isOpening={isOpening}
            openError={openError}
            patch={selectedPatch}
            onBack={() => setSelectedPatchId(null)}
            onOpen={requestOpen}
            onRetry={() => {
              if (selectedPatchId !== null)
                detailCache.current.delete(selectedPatchId)
              setDetailRequest((value) => value + 1)
            }}
          />
        </div>
      </section>

      {isConfirmingOpen && selectedPatch ? (
        <div className="patch-storage-confirmation-scrim">
          <section
            className="new-patch-dialog patch-storage-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="patch-storage-confirmation-title"
          >
            <header>
              <TriangleAlert size={21} />
              <h2 id="patch-storage-confirmation-title">
                Replace the current Workbench?
              </h2>
            </header>
            <p>
              Opening <strong>“{selectedPatch.title}”</strong> replaces{' '}
              <strong>“{currentPatchName}”</strong> in this session.
            </p>
            <div>
              <button
                ref={confirmationCancelRef}
                className="dialog-cancel"
                type="button"
                onClick={() => setIsConfirmingOpen(false)}
              >
                Cancel
              </button>
              <button
                className="dialog-create"
                type="button"
                onClick={() => void openSelectedPatch()}
              >
                Open Patch
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
