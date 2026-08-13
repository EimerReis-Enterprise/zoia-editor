import {
  ArrowLeft,
  Download,
  ExternalLink,
  Eye,
  Globe2,
  Heart,
  LoaderCircle,
  TriangleAlert,
} from 'lucide-react'

import { patchStorageCompatibility } from '#/lib/domain/patch-storage'
import type {
  PatchStoragePatchDetail,
  PatchStoragePatchSummary,
} from '#/lib/domain/patch-storage'

const compactNumber = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const fullNumber = new Intl.NumberFormat()
const shortDate = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function readablePatchStorageDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'Unknown date' : shortDate.format(date)
}

export function PatchStorageMetrics({
  patch,
}: {
  patch: PatchStoragePatchSummary
}) {
  return (
    <span className="patch-storage-metrics">
      <span title={`${fullNumber.format(patch.downloadCount)} downloads`}>
        <Download size={12} aria-hidden="true" />
        {compactNumber.format(patch.downloadCount)}
        <span className="sr-only"> downloads</span>
      </span>
      <span title={`${fullNumber.format(patch.likeCount)} likes`}>
        <Heart size={12} aria-hidden="true" />
        {compactNumber.format(patch.likeCount)}
        <span className="sr-only"> likes</span>
      </span>
      <span title={`${fullNumber.format(patch.viewCount)} views`}>
        <Eye size={12} aria-hidden="true" />
        {compactNumber.format(patch.viewCount)}
        <span className="sr-only"> views</span>
      </span>
    </span>
  )
}

type PatchStorageDetailProps = {
  detailError: string | null
  isDetailLoading: boolean
  isOpening: boolean
  openError: string | null
  patch: PatchStoragePatchDetail | null
  onBack: () => void
  onOpen: () => void
  onRetry: () => void
}

export function PatchStorageDetail({
  detailError,
  isDetailLoading,
  isOpening,
  openError,
  patch,
  onBack,
  onOpen,
  onRetry,
}: PatchStorageDetailProps) {
  const compatibility = patch ? patchStorageCompatibility(patch) : null

  return (
    <section
      className="patch-storage-detail"
      aria-label="Selected Patch details"
    >
      <button
        className="patch-storage-detail__back"
        type="button"
        onClick={onBack}
      >
        <ArrowLeft size={15} /> Back to results
      </button>
      {isDetailLoading ? (
        <div className="patch-storage-state">
          <LoaderCircle className="is-spinning" size={22} />
          <strong>Loading Patch details</strong>
        </div>
      ) : detailError ? (
        <div className="patch-storage-state is-error" role="alert">
          <TriangleAlert size={20} />
          <strong>Details unavailable</strong>
          <p>{detailError}</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : patch ? (
        <>
          <div className="patch-storage-detail__hero">
            {patch.artworkUrl ? (
              <img src={patch.artworkUrl} alt={`Artwork for ${patch.title}`} />
            ) : (
              <div aria-hidden="true">
                <Globe2 size={34} />
              </div>
            )}
            <div>
              <h3>{patch.title}</h3>
              <p>by {patch.author.name}</p>
              <PatchStorageMetrics patch={patch} />
            </div>
          </div>

          <dl className="patch-storage-facts">
            <div>
              <dt>Updated</dt>
              <dd>{readablePatchStorageDate(patch.updatedAt)}</dd>
            </div>
            <div>
              <dt>Revision</dt>
              <dd>{patch.revision || 'Not specified'}</dd>
            </div>
            <div>
              <dt>License</dt>
              <dd>{patch.license?.name ?? 'Not specified'}</dd>
            </div>
          </dl>

          <div
            className={`patch-storage-compatibility ${compatibility?.openable ? 'is-compatible' : 'is-incompatible'}`}
          >
            {compatibility?.openable ? (
              <>
                <Download size={17} />
                <div>
                  <strong>Ready for the Workbench</strong>
                  <span>{compatibility.file.filename}</span>
                </div>
              </>
            ) : (
              <>
                <TriangleAlert size={17} />
                <div>
                  <strong>Manual download required</strong>
                  <span>{compatibility?.reason}</span>
                </div>
              </>
            )}
          </div>

          {openError ? (
            <p className="patch-storage-open-error" role="alert">
              <TriangleAlert size={15} /> {openError}
            </p>
          ) : null}

          <footer className="patch-storage-detail__actions">
            <div>
              {patch.previewUrl ? (
                <a href={patch.previewUrl} target="_blank" rel="noreferrer">
                  Preview <ExternalLink size={13} />
                </a>
              ) : null}
              <a href={patch.url} target="_blank" rel="noreferrer">
                View on PatchStorage <ExternalLink size={13} />
              </a>
            </div>
            <button
              type="button"
              disabled={!compatibility?.openable || isOpening}
              onClick={onOpen}
            >
              {isOpening ? (
                <LoaderCircle className="is-spinning" size={16} />
              ) : (
                <Download size={16} />
              )}
              {isOpening ? 'Opening…' : 'Open in Workbench'}
            </button>
          </footer>

          <div className="patch-storage-description">
            <h4>Patch notes</h4>
            <p>
              {patch.description ||
                patch.excerpt ||
                'The author did not provide Patch notes.'}
            </p>
          </div>

          {patch.tags.length ? (
            <div className="patch-storage-tags" aria-label="Patch tags">
              {patch.tags.slice(0, 10).map((tag) => (
                <span key={tag.id}>{tag.name}</span>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="patch-storage-state">
          <Globe2 size={22} />
          <strong>Select a Patch</strong>
          <p>Choose a result to inspect its notes, license, and file.</p>
        </div>
      )}
    </section>
  )
}
