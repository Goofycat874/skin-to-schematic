import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react'
import { ICON } from './iconProps'
import { Swatch } from './ui'

// Top-down build guide for a single layer. North (the statue's front) is up
// and east is right, matching the in-game map orientation.
export function LayerView({ model, layerStarts, layer, onLayerChange, theme }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [box, setBox] = useState({ width: 300, height: 300 })
  const [hover, setHover] = useState(null)
  const height = model.height
  const hasLayers = height > 0
  const current = layer ?? Math.max(0, height - 1)

  const layerBlocks = useMemo(() => {
    if (!layerStarts || !height) return []
    return model.blocks.slice(layerStarts[current], layerStarts[current + 1])
  }, [model, layerStarts, current, height])

  const belowBlocks = useMemo(() => {
    if (!layerStarts || current === 0) return []
    return model.blocks.slice(layerStarts[current - 1], layerStarts[current])
  }, [model, layerStarts, current])

  const counts = useMemo(() => {
    const map = new Map()
    for (const block of layerBlocks) {
      const entry = map.get(block.state) ?? { ...block, count: 0 }
      entry.count += 1
      map.set(block.state, entry)
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [layerBlocks])

  useEffect(() => {
    const element = wrapRef.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => {
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasLayers])

  const W = model.width
  const L = model.length
  const cell = W && L ? Math.max(2, Math.floor(Math.min(box.width / W, box.height / L))) : 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !cell) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * cell * ratio
    canvas.height = L * cell * ratio
    canvas.style.width = `${W * cell}px`
    canvas.style.height = `${L * cell}px`
    const context = canvas.getContext('2d')
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, W * cell, L * cell)

    const dark = theme !== 'light'
    for (let z = 0; z < L; z += 1) {
      for (let x = 0; x < W; x += 1) {
        context.fillStyle = (x + z) % 2 ? (dark ? '#15181c' : '#eceee9') : dark ? '#121418' : '#f4f5f2'
        context.fillRect(x * cell, z * cell, cell, cell)
      }
    }

    context.globalAlpha = dark ? 0.2 : 0.25
    for (const block of belowBlocks) {
      context.fillStyle = `rgb(${block.color.join(',')})`
      context.fillRect(block.x * cell, block.z * cell, cell, cell)
    }
    context.globalAlpha = 1

    const inset = cell >= 8 ? 1 : 0
    for (const block of layerBlocks) {
      context.fillStyle = `rgb(${block.color.join(',')})`
      context.fillRect(block.x * cell + inset, block.z * cell + inset, cell - inset * 2, cell - inset * 2)
    }

    if (cell >= 6) {
      context.strokeStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'
      context.lineWidth = 1
      context.beginPath()
      for (let x = 0; x <= W; x += 1) {
        context.moveTo(x * cell + 0.5, 0)
        context.lineTo(x * cell + 0.5, L * cell)
      }
      for (let z = 0; z <= L; z += 1) {
        context.moveTo(0, z * cell + 0.5)
        context.lineTo(W * cell, z * cell + 0.5)
      }
      context.stroke()
    }
  }, [W, L, cell, layerBlocks, belowBlocks, theme])

  const blockAt = useMemo(() => {
    const map = new Map()
    for (const block of layerBlocks) map.set(block.z * W + block.x, block)
    return map
  }, [layerBlocks, W])

  if (!height) {
    return (
      <div className="panel-empty">
        <p>Load a skin to get a layer-by-layer build guide.</p>
      </div>
    )
  }

  return (
    <div className="layers">
      <div className="layer-controls">
        <button
          type="button"
          className="icon-button"
          onClick={() => onLayerChange(Math.max(0, current - 1))}
          disabled={current === 0}
          aria-label="Previous layer"
          title="Previous layer ([)"
        >
          <ChevronLeft {...ICON} aria-hidden="true" />
        </button>
        <div className="layer-readout">
          <strong className="mono">
            Layer {current + 1}
            <span> / {height}</span>
          </strong>
          <span>
            {layerBlocks.length.toLocaleString()} blocks
            {layer == null ? ' · showing the top' : ''}
          </span>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => onLayerChange(Math.min(height - 1, current + 1))}
          disabled={current >= height - 1}
          aria-label="Next layer"
          title="Next layer (])"
        >
          <ChevronRight {...ICON} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`icon-button ${layer == null ? 'is-active' : ''}`}
          onClick={() => onLayerChange(layer == null ? current : null)}
          aria-pressed={layer == null}
          title={layer == null ? 'Slice the 3D view at this layer' : 'Show every layer in 3D'}
          aria-label={layer == null ? 'Slice the 3D view at this layer' : 'Show every layer'}
        >
          <Layers {...ICON} aria-hidden="true" />
        </button>
      </div>

      <div className="layer-canvas-wrap" ref={wrapRef}>
        <span className="compass">N · front</span>
        <canvas
          ref={canvasRef}
          className="layer-canvas"
          role="img"
          aria-label={`Top-down map of layer ${current + 1}`}
          onPointerMove={(event) => {
            if (!cell) return
            const rect = event.currentTarget.getBoundingClientRect()
            const x = Math.floor((event.clientX - rect.left) / cell)
            const z = Math.floor((event.clientY - rect.top) / cell)
            const block = blockAt.get(z * W + x)
            setHover(block ? { block, left: event.clientX - rect.left, top: event.clientY - rect.top } : null)
          }}
          onPointerLeave={() => setHover(null)}
        />
        {hover ? (
          <div
            className="hover-card is-small"
            style={{ transform: `translate(${hover.left + 12}px, ${hover.top + 12}px)` }}
          >
            <Swatch color={hover.block.color} />
            <span className="hover-card-copy">
              <strong>{hover.block.label}</strong>
              <span className="mono">
                x {hover.block.x}, z {hover.block.z}
              </span>
            </span>
          </div>
        ) : null}
      </div>

      <input
        type="range"
        className="layer-range"
        min={0}
        max={height - 1}
        value={current}
        style={{ '--fill': `${height > 1 ? (current / (height - 1)) * 100 : 100}%` }}
        aria-label="Layer"
        onChange={(event) => onLayerChange(Number(event.target.value))}
      />

      <ul className="layer-materials">
        {counts.slice(0, 8).map((block) => (
          <li key={block.state}>
            <Swatch color={block.color} size="sm" />
            <span className="layer-material-name">{block.label}</span>
            <strong className="mono">{block.count}</strong>
          </li>
        ))}
        {counts.length > 8 ? <li className="more">+{counts.length - 8} more on this layer</li> : null}
      </ul>
    </div>
  )
}
