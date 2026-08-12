import { FileClock, RotateCcw, Upload, X } from 'lucide-react'

import { describePatchChanges } from '#/lib/domain/patch'
import type { PatchVersion } from '#/lib/domain/patch'

type VersionInspectorProps = {
  history: PatchVersion[]
  onClose: () => void
  onImport: () => void
  onRestore: (version: PatchVersion) => void
}

export function VersionInspector({
  history,
  onClose,
  onImport,
  onRestore,
}: VersionInspectorProps) {
  return (
    <aside className="version-inspector" aria-label="Version Inspector">
      <header>
        <FileClock size={19} />
        <div>
          <h2>Version Inspector</h2>
          <span>{history.length} SAVED {history.length === 1 ? 'VERSION' : 'VERSIONS'}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Version Inspector">
          <X size={17} />
        </button>
      </header>
      <div className="version-inspector__tools">
        <p>Each checkpoint shows its musical changes from the version before it.</p>
        <button type="button" onClick={onImport}>
          <Upload size={14} /> Load version files
        </button>
      </div>
      <ol className="version-timeline">
        {[...history].reverse().map((version) => {
          const index = history.findIndex(
            (candidate) => candidate.metadata.version === version.metadata.version,
          )
          const previous = index > 0 ? history[index - 1] : null
          const changes = describePatchChanges(previous?.document ?? null, version.document)
          return (
            <li key={`${version.metadata.seriesId}-${version.metadata.version}`}>
              <div className="version-timeline__heading">
                <strong>v{String(version.metadata.version).padStart(3, '0')}</strong>
                <time dateTime={version.metadata.savedAt}>
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(version.metadata.savedAt))}
                </time>
              </div>
              <p>{version.metadata.message}</p>
              <ul>
                {changes.slice(0, 8).map((change, changeIndex) => (
                  <li key={`${change.kind}-${change.summary}-${changeIndex}`}>
                    <span>{change.kind}</span> {change.summary}
                  </li>
                ))}
                {changes.length > 8 ? <li>+ {changes.length - 8} more changes</li> : null}
              </ul>
              <button type="button" onClick={() => onRestore(version)}>
                <RotateCcw size={13} /> Restore as working copy
              </button>
            </li>
          )
        })}
      </ol>
      {!history.length ? (
        <div className="version-inspector__empty">
          <FileClock size={28} />
          <strong>No saved versions yet</strong>
          <p>Save the current Patch Version or load existing version files.</p>
        </div>
      ) : null}
    </aside>
  )
}
