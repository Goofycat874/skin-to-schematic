import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Keyboard, Moon, Sun } from 'lucide-react'
import './App.css'
import { ControlPanel } from './components/ControlPanel'
import { ExportPanel } from './components/ExportPanel'
import { LayerView } from './components/LayerView'
import { MaterialsPanel } from './components/MaterialsPanel'
import { DropOverlay, ShortcutsDialog, Toasts } from './components/Overlays'
import { SkinSource } from './components/SkinSource'
import { ICON } from './components/iconProps'
import { Viewer } from './components/Viewer'
import { readStorage, usePersistentState, writeStorage } from './hooks/usePersistentState'
import { materialsToCsv, materialsToText } from './lib/materials'
import { createDownload, EXPORT_FORMATS } from './lib/schematicWriters'
import { DEFAULT_OPTIONS, buildSkinModel, readSkinFile } from './lib/skinModel'
import {
  SAMPLE_SKINS,
  fetchSkinByUsername,
  isPngFile,
  loadSkinFromUrl,
} from './lib/skinSources'

const SKIN_KEY = 'skinforge:skin'
const RENDER_MODES = ['blocks', 'skin', 'accuracy']

function sanitizeOptions(value) {
  const merged = { ...DEFAULT_OPTIONS, ...(value && typeof value === 'object' ? value : {}) }
  if (!Array.isArray(merged.filters)) merged.filters = DEFAULT_OPTIONS.filters
  if (!Array.isArray(merged.excludedBlocks)) merged.excludedBlocks = []
  merged.tone = { ...DEFAULT_OPTIONS.tone, ...(merged.tone ?? {}) }
  if (!merged.customPose || typeof merged.customPose !== 'object') merged.customPose = {}
  return merged
}

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function stemFrom(name) {
  return (name ?? 'skin')
    .replace(/\.png$/i, '')
    .replace(/[^a-z0-9-_ ]+/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}

function downloadBlob(blob, filename) {
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function matchQuality(error) {
  if (error < 3) return 'Excellent'
  if (error < 6) return 'Good'
  if (error < 10) return 'Fair'
  return 'Rough'
}

function isTypingTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

export default function App() {
  const [storedOptions, setStoredOptions] = usePersistentState('skinforge:options', DEFAULT_OPTIONS)
  const options = useMemo(() => sanitizeOptions(storedOptions), [storedOptions])
  const setOptions = useCallback(
    (update) =>
      setStoredOptions((current) =>
        typeof update === 'function' ? update(sanitizeOptions(current)) : update,
      ),
    [setStoredOptions],
  )
  const setOption = useCallback(
    (key, value) => setOptions((current) => ({ ...current, [key]: value })),
    [setOptions],
  )

  const [theme, setTheme] = usePersistentState('skinforge:theme', systemTheme())
  const [exportFormat, setExportFormat] = usePersistentState('skinforge:format', 'schem')
  const [renderMode, setRenderMode] = usePersistentState('skinforge:render', 'blocks')
  const [showEdges, setShowEdges] = usePersistentState('skinforge:edges', true)
  const [tab, setTab] = usePersistentState('skinforge:tab', 'materials')
  const [autoRotate, setAutoRotate] = useState(false)

  const [skin, setSkin] = useState(null)
  const [source, setSource] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [samples, setSamples] = useState({})
  const [layer, setLayer] = useState(null)
  const [fileStem, setFileStem] = useState('')
  const [toasts, setToasts] = useState([])
  const [dragging, setDragging] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const viewRef = useRef(null)
  const fileInputRef = useRef(null)

  const deferredOptions = useDeferredValue(options)
  const deferredSkin = useDeferredValue(skin)
  const model = useMemo(
    () => buildSkinModel(deferredSkin, deferredOptions),
    [deferredSkin, deferredOptions],
  )
  const updating = deferredOptions !== options || deferredSkin !== skin

  const layerStarts = useMemo(() => {
    const starts = new Int32Array(model.height + 1)
    let index = 0
    for (let y = 0; y <= model.height; y += 1) {
      while (index < model.blocks.length && model.blocks[index].y < y) index += 1
      starts[y] = index
    }
    return starts
  }, [model])
  const activeLayer = layer != null && layer < model.height ? layer : null

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toast = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((current) => [...current.slice(-2), { id, message, tone }])
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3600)
  }, [])

  const commitSkin = useCallback(
    (next, kind, { quiet = false } = {}) => {
      setSkin(next)
      setSource(kind)
      setFileStem(stemFrom(next.name))
      setLayer(null)
      setLoading(false)
      setLoadError(null)
      if (next.url && next.url.length < 200_000) {
        writeStorage(SKIN_KEY, { name: next.name, url: next.url, source: kind })
      }
      if (!quiet) toast(`${next.name.replace(/\.png$/i, '')} loaded`, 'success')
    },
    [toast],
  )

  const failSkin = useCallback(
    (error) => {
      setLoading(false)
      setLoadError(error.message)
      toast(error.message, 'error')
    },
    [toast],
  )

  const applySkin = useCallback(
    async (loader, kind, options) => {
      setLoading(true)
      setLoadError(null)
      try {
        commitSkin(await loader, kind, options)
      } catch (error) {
        failSkin(error)
        throw error
      }
    },
    [commitSkin, failSkin],
  )

  const handleFile = useCallback(
    (file, kind = 'file') => {
      if (!file) return
      if (!isPngFile(file)) {
        toast('Skins are PNG files. That one is not.', 'error')
        return
      }
      applySkin(readSkinFile(file), kind).catch(() => {})
    },
    [applySkin, toast],
  )

  // First load: sample thumbnails, then the last skin or the first sample.
  useEffect(() => {
    let cancelled = false
    Promise.all(
      SAMPLE_SKINS.map((sample) =>
        loadSkinFromUrl(sample.url, `${sample.name}.png`).then(
          (loaded) => [sample.id, loaded],
          () => null,
        ),
      ),
    ).then((entries) => {
      if (!cancelled) setSamples(Object.fromEntries(entries.filter(Boolean)))
    })

    const saved = readStorage(SKIN_KEY, null)
    const first = SAMPLE_SKINS[0]
    const loadFirst = () =>
      loadSkinFromUrl(first.url, `${first.name}.png`).then((next) => {
        if (!cancelled) commitSkin(next, 'sample', { quiet: true })
      })
    const initial =
      saved?.url && saved?.name
        ? loadSkinFromUrl(saved.url, saved.name).then((next) => {
            if (!cancelled) {
              commitSkin(next, saved.source === 'sample' ? 'sample' : 'saved', { quiet: true })
            }
          })
        : loadFirst()
    initial
      .catch(() => (saved ? loadFirst() : Promise.reject(new Error('Could not load the sample skin.'))))
      .catch((error) => {
        if (!cancelled) failSkin(error)
      })
    return () => {
      cancelled = true
    }
  }, [commitSkin, failSkin])

  // Paste and drag-and-drop anywhere on the page.
  useEffect(() => {
    let depth = 0
    const hasFiles = (event) => [...(event.dataTransfer?.types ?? [])].includes('Files')
    const onPaste = (event) => {
      if (isTypingTarget(event.target)) return
      const item = [...(event.clipboardData?.items ?? [])].find((entry) => entry.type.startsWith('image/'))
      if (!item) return
      event.preventDefault()
      const file = item.getAsFile()
      if (!file) return
      handleFile(new File([file], file.name || 'pasted-skin.png', { type: file.type }), 'paste')
    }
    const onEnter = (event) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth += 1
      setDragging(true)
    }
    const onOver = (event) => {
      if (hasFiles(event)) event.preventDefault()
    }
    const onLeave = (event) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (event) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      handleFile(event.dataTransfer.files[0])
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [handleFile])

  const displayName = skin ? skin.name.replace(/\.png$/i, '') : null
  const formatInfo = EXPORT_FORMATS.find((entry) => entry.id === exportFormat) ?? EXPORT_FORMATS[0]

  const exportModel = useCallback(() => {
    try {
      const current = updating ? buildSkinModel(skin, options) : model
      const { blob, filename } = createDownload(
        current,
        formatInfo.id,
        stemFrom(fileStem) || 'skin-statue',
        { title: displayName ?? 'Skinforge statue', author: 'Skinforge' },
      )
      downloadBlob(blob, filename)
      toast(`Saved ${filename} (${formatBytes(blob.size)})`, 'success')
    } catch (error) {
      toast(error.message, 'error')
    }
  }, [updating, skin, options, model, formatInfo.id, fileStem, displayName, toast])

  const pasteFromClipboard = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((entry) => entry.startsWith('image/'))
        if (type) {
          const blob = await item.getType(type)
          handleFile(new File([blob], 'pasted-skin.png', { type }), 'paste')
          return
        }
      }
      toast('No image on the clipboard. Copy a skin PNG first.', 'error')
    } catch {
      toast('Your browser blocked clipboard access. Press Ctrl+V instead.', 'info')
    }
  }, [handleFile, toast])

  const takeScreenshot = useCallback(async () => {
    const blob = await viewRef.current?.screenshot()
    if (!blob) return
    const name = `${stemFrom(fileStem) || 'skin-statue'}.png`
    downloadBlob(blob, name)
    toast(`Saved ${name}`, 'success')
  }, [fileStem, toast])

  const banBlock = useCallback(
    (block) => {
      setOptions((current) => ({
        ...current,
        excludedBlocks: [...new Set([...current.excludedBlocks, block.state])],
      }))
      toast(`${block.label} banned. Re-matching ${block.count.toLocaleString()} blocks.`, 'info')
    },
    [setOptions, toast],
  )

  const stepLayer = useCallback(
    (direction) => {
      const height = model.height
      if (!height) return
      const current = activeLayer ?? height - 1
      if (direction < 0) setLayer(Math.max(0, current - 1))
      else if (activeLayer != null) setLayer(current + 1 >= height ? null : current + 1)
    },
    [model.height, activeLayer],
  )

  useEffect(() => {
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target) || shortcutsOpen) return
      const views = { 1: 'front', 2: 'side', 3: 'back', 4: 'top', 5: 'iso' }
      const key = event.key
      if (views[key]) viewRef.current?.setView(views[key])
      else if (key === 'o' || key === 'O') fileInputRef.current?.click()
      else if (key === 'e' || key === 'E') exportModel()
      else if (key === 'f' || key === 'F') viewRef.current?.fit()
      else if (key === 'r' || key === 'R') setAutoRotate((value) => !value)
      else if (key === 'g' || key === 'G') setShowEdges((value) => !value)
      else if (key === 'm' || key === 'M') {
        setRenderMode((value) => RENDER_MODES[(RENDER_MODES.indexOf(value) + 1) % RENDER_MODES.length])
      } else if (key === '[') stepLayer(-1)
      else if (key === ']') stepLayer(1)
      else if (key === 'Escape') setLayer(null)
      else if (key === '?') setShortcutsOpen(true)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [exportModel, stepLayer, shortcutsOpen, setRenderMode, setShowEdges])

  const tabs = [
    { id: 'materials', label: 'Materials', count: model.usedBlocks.length || null },
    { id: 'layers', label: 'Layers', count: model.height || null },
    { id: 'export', label: 'Export' },
  ]
  const activeTab = tabs.some((entry) => entry.id === tab) ? tab : 'materials'
  const savedShare = model.stats.solidVolume
    ? Math.round((model.stats.hiddenRemoved / model.stats.solidVolume) * 100)
    : 0

  return (
    <div className="app">
      <a className="skip-link" href="#workspace">
        Skip to the editor
      </a>
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <span className="brand-name">Skinforge</span>
          <span className="brand-tag">Skin to schematic</span>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => setShortcutsOpen(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard {...ICON} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            {theme === 'dark' ? <Sun {...ICON} aria-hidden="true" /> : <Moon {...ICON} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="button is-primary"
            onClick={exportModel}
            disabled={model.blocks.length === 0}
            title="Export (E)"
          >
            <Download {...ICON} aria-hidden="true" />
            Export {formatInfo.extension}
          </button>
        </div>
      </header>

      <main className="workspace" id="workspace">
        <aside className="panel controls" aria-label="Skin and build settings">
          <div className="panel-scroll">
            <section className="section">
              <div className="section-head">
                <h3>Skin</h3>
              </div>
              <div className="section-body">
                <SkinSource
                  skin={skin}
                  source={source}
                  skinType={model.skinType}
                  samples={samples}
                  loading={loading}
                  onUploadClick={() => fileInputRef.current?.click()}
                  onPaste={pasteFromClipboard}
                  onSample={(sample) =>
                    applySkin(loadSkinFromUrl(sample.url, `${sample.name}.png`), 'sample').catch(() => {})
                  }
                  onUsername={(name) => applySkin(fetchSkinByUsername(name), 'username')}
                />
              </div>
            </section>
            <ControlPanel
              options={options}
              setOption={setOption}
              setOptions={setOptions}
              detectedModel={model.detectedModel}
              resetOptions={() => {
                setOptions(DEFAULT_OPTIONS)
                toast('Settings reset', 'info')
              }}
            />
          </div>
        </aside>

        <section className="panel viewer" aria-label="3D preview">
          <Viewer
            model={model}
            layerStarts={layerStarts}
            layer={activeLayer}
            onLayerChange={setLayer}
            renderMode={renderMode}
            onRenderMode={setRenderMode}
            showEdges={showEdges}
            onShowEdges={setShowEdges}
            autoRotate={autoRotate}
            onAutoRotate={setAutoRotate}
            theme={theme}
            viewRef={viewRef}
            onScreenshot={takeScreenshot}
            skinName={displayName}
            loading={loading}
            error={loadError}
            updating={updating}
          />
          <dl className="stats">
            <div>
              <dt>Blocks</dt>
              <dd className="mono">{model.blocks.length.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd className="mono">
                {model.width} × {model.height} × {model.length}
              </dd>
            </div>
            <div>
              <dt>Materials</dt>
              <dd className="mono">{model.usedBlocks.length}</dd>
            </div>
            <div>
              <dt>Color match</dt>
              <dd>
                {model.stats.skinBlocks ? (
                  <>
                    {matchQuality(model.averageMatchError)}{' '}
                    <span className="mono muted">ΔE {model.averageMatchError.toFixed(1)}</span>
                  </>
                ) : (
                  <span className="muted">None yet</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Hollowed out</dt>
              <dd className="mono">{savedShare}%</dd>
            </div>
          </dl>
        </section>

        <aside className="panel inspector" aria-label="Materials, layers, and export">
          <div className="tabs" role="tablist" aria-label="Build details">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`tab-${entry.id}`}
                aria-selected={activeTab === entry.id}
                aria-controls={`tabpanel-${entry.id}`}
                className={activeTab === entry.id ? 'is-selected' : ''}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
                {entry.count ? <span className="tab-count mono">{entry.count}</span> : null}
              </button>
            ))}
          </div>
          <div
            className="panel-scroll tab-panel"
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === 'materials' ? (
              <MaterialsPanel
                model={model}
                excluded={options.excludedBlocks}
                onBan={banBlock}
                onUnban={(state) =>
                  setOption(
                    'excludedBlocks',
                    options.excludedBlocks.filter((entry) => entry !== state),
                  )
                }
                onCopy={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      materialsToText(model.usedBlocks, `${displayName ?? 'Skinforge'} material list`),
                    )
                    toast('Material list copied', 'success')
                  } catch {
                    toast('Clipboard is blocked. Use the CSV download instead.', 'error')
                  }
                }}
                onDownloadCsv={() => {
                  const name = `${stemFrom(fileStem) || 'skin-statue'}-materials.csv`
                  downloadBlob(new Blob([materialsToCsv(model.usedBlocks)], { type: 'text/csv' }), name)
                  toast(`Saved ${name}`, 'success')
                }}
              />
            ) : null}
            {activeTab === 'layers' ? (
              <LayerView
                model={model}
                layerStarts={layerStarts}
                layer={activeLayer}
                onLayerChange={setLayer}
                theme={theme}
              />
            ) : null}
            {activeTab === 'export' ? (
              <ExportPanel
                model={model}
                format={formatInfo.id}
                onFormat={setExportFormat}
                fileStem={fileStem}
                onFileStem={setFileStem}
                onExport={exportModel}
              />
            ) : null}
          </div>
        </aside>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        hidden
        onChange={(event) => {
          handleFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <DropOverlay visible={dragging} />
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3 28 10 16 17 4 10Z" fill="var(--accent)" />
      <path d="M4 10 16 17V30L4 23Z" fill="currentColor" opacity="0.55" />
      <path d="M28 10 16 17V30L28 23Z" fill="currentColor" opacity="0.85" />
    </svg>
  )
}
