import { useMemo, useRef, useState } from 'react'
import {
  Boxes,
  Check,
  ChevronDown,
  CircleCheck,
  Download,
  FileImage,
  RotateCcw,
  Upload,
} from 'lucide-react'
import './App.css'
import { VoxelPreview } from './components/VoxelPreview'
import {
  SURVIVAL_MIXED_BLOCKS,
  SURVIVAL_MIXED_VERSION,
} from './generated/survivalMixedPalette.js'
import { paletteOptions } from './lib/palettes'
import { buildSkinModel, readSkinFile } from './lib/skinModel'
import { createDownload } from './lib/schematicWriters'

const defaultOptions = {
  palette: 'mixed',
  scale: 1,
  thickness: 1,
  includeBase: true,
  includeOverlay: true,
  overlayMode: 'flatten',
  alphaCutoff: 24,
}

function App() {
  const fileInputRef = useRef(null)
  const [skin, setSkin] = useState(null)
  const [options, setOptions] = useState(defaultOptions)
  const [dragActive, setDragActive] = useState(false)
  const [status, setStatus] = useState('Ready')

  const model = useMemo(() => buildSkinModel(skin, options), [skin, options])
  const selectedPalette =
    paletteOptions.find((palette) => palette.id === options.palette) ??
    paletteOptions[0]
  const dimensions = model.width
    ? `${model.width} x ${model.height} x ${model.length}`
    : '0 x 0 x 0'
  const highestUsage = model.usedBlocks[0]?.count ?? 1

  async function handleFile(file) {
    if (!file) return
    if (!file.type.includes('png')) {
      setStatus('PNG files only')
      return
    }

    try {
      const nextSkin = await readSkinFile(file)
      setSkin(nextSkin)
      setStatus(`${file.name} loaded`)
    } catch (error) {
      setStatus(error.message)
    }
  }

  function download() {
    try {
      const fileStem = (skin?.name ?? 'minecraft-skin')
        .replace(/\.png$/i, '')
        .replace(/[^a-z0-9-_]+/gi, '-')
        .replace(/^-+|-+$/g, '')
      const { blob, filename } = createDownload(
        model,
        'schem',
        fileStem || 'minecraft-skin',
      )
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(href)
      setStatus(`${filename} exported`)
    } catch (error) {
      setStatus(error.message)
    }
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#converter">
        Skip to converter
      </a>

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Boxes size={20} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <h1>Skinforge</h1>
            <p>Skin to schematic studio</p>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="version-stamp">Java {SURVIVAL_MIXED_VERSION}</span>
          <span className="status">
            <i aria-hidden="true" />
            {status}
          </span>
          <button
            className="primary-button"
            type="button"
            onClick={download}
            disabled={model.blocks.length === 0}
          >
            <Download size={16} strokeWidth={2} aria-hidden="true" />
            Export
          </button>
        </div>
      </header>

      <section className="workbench" id="converter">
        <aside className="control-rail" aria-label="Conversion controls">
          <ControlSection index="01" title="Source skin">
            <div
              className={`drop-zone ${dragActive ? 'is-active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                event.preventDefault()
                setDragActive(false)
              }}
              onDrop={(event) => {
                event.preventDefault()
                setDragActive(false)
                handleFile(event.dataTransfer.files[0])
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  fileInputRef.current?.click()
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png"
                hidden
                onChange={(event) => handleFile(event.target.files[0])}
              />
              <span className="skin-frame">
                {skin ? (
                  <img className="skin-thumb" src={skin.url} alt="Uploaded skin" />
                ) : (
                  <FileImage size={24} strokeWidth={1.6} aria-hidden="true" />
                )}
              </span>
              <span className="drop-copy">
                <strong>{skin?.name ?? 'Choose a skin'}</strong>
                <small>
                  {skin ? `${skin.width} x ${skin.height} PNG` : '64 x 64 or 64 x 32 PNG'}
                </small>
              </span>
              <span className="upload-action" title="Upload skin">
                <Upload size={16} aria-hidden="true" />
              </span>
            </div>
          </ControlSection>

          <ControlSection index="02" title="Block matching">
            <label className="field-label" htmlFor="palette-select">
              Palette
            </label>
            <div className="select-control">
              <Boxes size={17} strokeWidth={1.7} aria-hidden="true" />
              <select
                id="palette-select"
                value={options.palette}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    palette: event.target.value,
                  }))
                }
              >
                {paletteOptions.map((palette) => (
                  <option key={palette.id} value={palette.id}>
                    {palette.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
            <p className="field-help">{selectedPalette.description}</p>
          </ControlSection>

          <ControlSection index="03" title="Geometry">
            <div className="toggle-list">
              <Toggle
                label="Base skin"
                checked={options.includeBase}
                onChange={(checked) =>
                  setOptions((current) => ({ ...current, includeBase: checked }))
                }
              />
              <Toggle
                label="Hat and overlays"
                checked={options.includeOverlay}
                onChange={(checked) =>
                  setOptions((current) => ({
                    ...current,
                    includeOverlay: checked,
                  }))
                }
              />
            </div>

            <div className="mode-switch" aria-label="Overlay mode">
              <button
                className={options.overlayMode === 'flatten' ? 'is-selected' : ''}
                type="button"
                onClick={() =>
                  setOptions((current) => ({
                    ...current,
                    overlayMode: 'flatten',
                  }))
                }
              >
                Merge
              </button>
              <button
                className={options.overlayMode === 'shell' ? 'is-selected' : ''}
                type="button"
                onClick={() =>
                  setOptions((current) => ({
                    ...current,
                    overlayMode: 'shell',
                  }))
                }
              >
                3D shell
              </button>
            </div>

            <div className="control-stack">
              <RangeControl
                label="Scale"
                min={1}
                max={3}
                value={options.scale}
                unit="x"
                onChange={(scale) =>
                  setOptions((current) => ({ ...current, scale }))
                }
              />
              <RangeControl
                label="Thickness"
                min={1}
                max={3}
                value={options.thickness}
                unit=" blocks"
                onChange={(thickness) =>
                  setOptions((current) => ({ ...current, thickness }))
                }
              />
            </div>
          </ControlSection>
        </aside>

        <section className="viewer-panel" aria-label="Schematic preview">
          <div className="viewer-toolbar">
            <div>
              <span className="eyeline">Live voxel model</span>
              <h2>{skin ? skin.name.replace(/\.png$/i, '') : 'No skin loaded'}</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              title="Reset conversion settings"
              aria-label="Reset conversion settings"
              onClick={() => setOptions(defaultOptions)}
            >
              <RotateCcw size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>

          <VoxelPreview model={model} />

          <div className="viewer-metrics" aria-label="Model summary">
            <ViewerMetric label="Volume" value={model.blocks.length.toLocaleString()} />
            <ViewerMetric label="Bounds" value={dimensions} />
            <ViewerMetric label="Materials" value={model.paletteStates.length || 0} />
          </div>
        </section>

        <aside className="export-rail" aria-label="Export details">
          <div className="export-heading">
            <div>
              <span className="eyeline">Build manifest</span>
              <h2>Ready to export</h2>
            </div>
            <CircleCheck size={22} strokeWidth={1.7} aria-hidden="true" />
          </div>

          <div className="format-row">
            <span>
              <small>Format</small>
              <strong>Sponge schematic</strong>
            </span>
            <code>.schem</code>
          </div>

          <div className="quality-grid">
            <Metric label="Blocks" value={model.blocks.length.toLocaleString()} />
            <Metric label="Dimensions" value={dimensions} />
            <Metric label="Materials" value={model.paletteStates.length || 0} />
            <Metric
              label="Mean match"
              value={model.blocks.length ? `${model.averageMatchError.toFixed(1)} dE` : '--'}
            />
          </div>

          <section className="block-mix" aria-labelledby="block-mix-title">
            <div className="subsection-heading">
              <h3 id="block-mix-title">Block mix</h3>
              <span>{model.paletteStates.length || 0} total</span>
            </div>
            <div className="block-usage">
              {model.usedBlocks.slice(0, 7).map((block) => (
                <div className="block-usage-row" key={block.state} title={block.state}>
                  <span
                    className="block-swatch"
                    style={{ backgroundColor: `rgb(${block.color.join(',')})` }}
                  />
                  <span className="block-name">{block.label}</span>
                  <span className="usage-track" aria-hidden="true">
                    <i style={{ width: `${(block.count / highestUsage) * 100}%` }} />
                  </span>
                  <strong>{block.count.toLocaleString()}</strong>
                </div>
              ))}
            </div>
          </section>

          <div className={`validation-note ${model.warnings.length ? 'has-warning' : ''}`}>
            {model.warnings.length ? (
              model.warnings.map((warning) => <p key={warning}>{warning}</p>)
            ) : (
              <>
                <Check size={15} strokeWidth={2.2} aria-hidden="true" />
                <p>Modern block states validated</p>
              </>
            )}
          </div>

          <div className="export-footer">
            <p>
              Java {SURVIVAL_MIXED_VERSION} · {SURVIVAL_MIXED_BLOCKS.length}{' '}
              survival blocks indexed
            </p>
            <button
              className="download-button"
              type="button"
              onClick={download}
              disabled={model.blocks.length === 0}
            >
              <Download size={17} strokeWidth={2} aria-hidden="true" />
              Export .schem
            </button>
          </div>
        </aside>
      </section>
    </main>
  )
}

function ControlSection({ index, title, children }) {
  return (
    <section className="control-section">
      <div className="section-heading">
        <span>{index}</span>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  )
}

function RangeControl({ label, min, max, value, unit, onChange }) {
  return (
    <label className="range-control">
      <span>
        {label}
        <strong>
          {value}
          {unit}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function ViewerMetric({ label, value }) {
  return (
    <div className="viewer-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default App
