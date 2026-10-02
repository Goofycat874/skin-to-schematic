import { Download, FileBox, FileCode2, TriangleAlert, Boxes } from 'lucide-react'
import { SURVIVAL_MIXED_VERSION } from '../generated/survivalMixedPalette.js'
import { EXPORT_FORMATS } from '../lib/schematicWriters'
import { ICON } from './iconProps'

const FORMAT_ICONS = { schem: Boxes, litematic: FileBox, mcfunction: FileCode2 }

const HOW_TO = {
  schem: [
    'Put the file in plugins/WorldEdit/schematics (or config/worldedit/schematics).',
    'Run //schem load <name>, stand on the ground, then //paste -a.',
  ],
  litematic: [
    'Put the file in .minecraft/schematics.',
    'Open Litematica (M), load it, and place it. Its material list matches the one here.',
  ],
  mcfunction: [
    'Drop it into a datapack under data/<namespace>/function/ and run /reload.',
    'Face south and run /function <namespace>:<name>. It builds in front of you.',
  ],
}

export function ExportPanel({ model, format, onFormat, fileStem, onFileStem, onExport }) {
  const empty = model.blocks.length === 0
  const extension = EXPORT_FORMATS.find((entry) => entry.id === format)?.extension ?? '.schem'

  return (
    <div className="export">
      <div className="format-list" role="radiogroup" aria-label="Export format">
        {EXPORT_FORMATS.map((entry) => {
          const Icon = FORMAT_ICONS[entry.id]
          const selected = entry.id === format
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`format-card ${selected ? 'is-selected' : ''}`}
              onClick={() => onFormat(entry.id)}
            >
              <span className="format-icon">
                <Icon {...ICON} size={18} aria-hidden="true" />
              </span>
              <span className="format-copy">
                <strong>
                  {entry.label} <code>{entry.extension}</code>
                </strong>
                <span>{entry.description}</span>
                <small>{entry.tools}</small>
              </span>
            </button>
          )
        })}
      </div>

      <div className="field">
        <div className="field-label">
          <label htmlFor="file-stem">File name</label>
        </div>
        <div className="filename-input">
          <input
            id="file-stem"
            type="text"
            value={fileStem}
            spellCheck="false"
            onChange={(event) => onFileStem(event.target.value)}
          />
          <span className="mono">{extension}</span>
        </div>
      </div>

      <button type="button" className="button is-primary is-large" disabled={empty} onClick={onExport}>
        <Download {...ICON} aria-hidden="true" />
        Export {extension}
      </button>

      <div className="how-to">
        <h4>Getting it into your world</h4>
        <ol>
          {HOW_TO[format].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p>
          Built for Java {SURVIVAL_MIXED_VERSION}. The statue faces north and its origin is the
          bottom north-west corner.
        </p>
      </div>

      {model.warnings.length ? (
        <div className="notice is-warning" role="status">
          <TriangleAlert {...ICON} aria-hidden="true" />
          <div>
            {model.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
