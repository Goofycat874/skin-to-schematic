import { useMemo, useState } from 'react'
import { Ban, ClipboardCopy, FileDown, Search, Undo2 } from 'lucide-react'
import { formatShulkers, formatStacks, SHULKER, STACK } from '../lib/materials'
import { ICON } from './iconProps'
import { Swatch } from './ui'

const LIST_CAP = 14

export function MaterialsPanel({ model, excluded, onBan, onUnban, onCopy, onDownloadCsv }) {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const total = model.blocks.length
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return model.usedBlocks
    return model.usedBlocks.filter(
      (block) =>
        block.label.toLowerCase().includes(needle) || block.state.toLowerCase().includes(needle),
    )
  }, [model.usedBlocks, query])
  const largest = model.usedBlocks[0]?.count ?? 1
  const capped = !showAll && !query.trim() && rows.length > LIST_CAP
  const visibleRows = capped ? rows.slice(0, LIST_CAP) : rows

  if (!total) {
    return (
      <div className="panel-empty">
        <p>Materials show up here once a skin is loaded.</p>
      </div>
    )
  }

  return (
    <div className="materials">
      <div className="summary-grid">
        <div>
          <span>Blocks</span>
          <strong className="mono">{total.toLocaleString()}</strong>
        </div>
        <div>
          <span>Stacks</span>
          <strong className="mono">{Math.ceil(total / STACK).toLocaleString()}</strong>
        </div>
        <div>
          <span>Shulkers</span>
          <strong className="mono">{(total / SHULKER).toFixed(1)}</strong>
        </div>
      </div>

      <div className="materials-tools">
        <div className="search-input">
          <Search {...ICON} size={15} aria-hidden="true" />
          <label htmlFor="material-search" className="sr-only">
            Search materials
          </label>
          <input
            id="material-search"
            type="search"
            placeholder={`Search ${model.usedBlocks.length} materials`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button type="button" className="icon-button" onClick={onCopy} title="Copy list" aria-label="Copy material list">
          <ClipboardCopy {...ICON} aria-hidden="true" />
        </button>
        <button type="button" className="icon-button" onClick={onDownloadCsv} title="Download CSV" aria-label="Download material list as CSV">
          <FileDown {...ICON} aria-hidden="true" />
        </button>
      </div>

      <ul className="material-list">
        {visibleRows.map((block) => {
          const shulkers = formatShulkers(block.count)
          const bannable = block.kind === 'skin'
          return (
            <li key={block.state} className="material-row" title={block.state}>
              <Swatch color={block.color} />
              <span className="material-copy">
                <strong>{block.label}</strong>
                <span className="mono">
                  {formatStacks(block.count)}
                  {shulkers ? ` · ${shulkers}` : ''}
                  {block.kind !== 'skin' ? ` · ${block.kind}` : ''}
                </span>
              </span>
              <span className="material-count mono">{block.count.toLocaleString()}</span>
              {bannable ? (
                <button
                  type="button"
                  className="row-action"
                  onClick={() => onBan(block)}
                  aria-label={`Never use ${block.label}`}
                  title="Never use this block"
                >
                  <Ban {...ICON} size={15} aria-hidden="true" />
                </button>
              ) : (
                <span className="row-action-spacer" />
              )}
              <i
                className="material-share"
                style={{ width: `${(block.count / largest) * 100}%` }}
                aria-hidden="true"
              />
            </li>
          )
        })}
        {rows.length === 0 ? <li className="material-none">No materials match “{query}”.</li> : null}
      </ul>
      {capped ? (
        <button type="button" className="button show-all" onClick={() => setShowAll(true)}>
          Show all {rows.length} materials
        </button>
      ) : null}

      {excluded.length ? (
        <div className="banned-list">
          <h4>Banned blocks</h4>
          <div className="chip-row">
            {excluded.map((state) => (
              <button
                key={state}
                type="button"
                className="chip is-removable"
                onClick={() => onUnban(state)}
                title="Allow this block again"
              >
                {prettyState(state)}
                <Undo2 {...ICON} size={13} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function prettyState(state) {
  return state
    .replace(/^minecraft:/, '')
    .replace(/\[.*$/, '')
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}
