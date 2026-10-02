import { useEffect, useRef, useState } from 'react'
import {
  Camera,
  Focus,
  Grid3x3,
  LoaderCircle,
  Maximize,
  Minimize,
  Rotate3d,
  TriangleAlert,
} from 'lucide-react'
import { heat } from '../lib/viewColors'
import { ICON } from './iconProps'
import { IconButton, Segmented } from './ui'
import { VoxelPreview } from './VoxelPreview'

const VIEWS = [
  { value: 'front', label: 'Front', key: '1' },
  { value: 'side', label: 'Side', key: '2' },
  { value: 'back', label: 'Back', key: '3' },
  { value: 'top', label: 'Top', key: '4' },
  { value: 'iso', label: '3D', key: '5' },
]

const MODES = [
  { value: 'blocks', label: 'Blocks', title: 'Matched block colors' },
  { value: 'skin', label: 'Skin', title: 'Original skin colors' },
  { value: 'accuracy', label: 'Match', title: 'How close each block is to the skin' },
]

export function Viewer({
  model,
  layerStarts,
  layer,
  onLayerChange,
  renderMode,
  onRenderMode,
  showEdges,
  onShowEdges,
  autoRotate,
  onAutoRotate,
  theme,
  viewRef,
  onScreenshot,
  skinName,
  loading,
  error,
  updating,
}) {
  const stageRef = useRef(null)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else stageRef.current?.requestFullscreen?.()
  }

  const height = model.height
  const sliderValue = layer == null ? height : layer
  const empty = model.blocks.length === 0

  return (
    <div className="viewer-stage" ref={stageRef}>
      <VoxelPreview
        model={model}
        layerStarts={layerStarts}
        layer={layer}
        renderMode={renderMode}
        showEdges={showEdges}
        autoRotate={autoRotate}
        theme={theme}
        viewRef={viewRef}
      />

      <div className="viewer-top">
        <div className="viewer-title">
          <h2>{skinName ?? 'Skinforge'}</h2>
          {updating ? (
            <span className="updating">
              <LoaderCircle {...ICON} size={13} className="spin" aria-hidden="true" />
              Updating
            </span>
          ) : null}
        </div>
        <div className="toolbar" role="toolbar" aria-label="View controls">
          <div className="toolbar-group" role="group" aria-label="Camera views">
            {VIEWS.map((view) => (
              <button
                key={view.value}
                type="button"
                className="toolbar-text"
                onClick={() => viewRef.current?.setView(view.value)}
                title={`${view.label} view (${view.key})`}
                disabled={empty}
              >
                {view.label}
              </button>
            ))}
          </div>
          <span className="toolbar-divider" aria-hidden="true" />
          <IconButton label="Frame the statue" shortcut="F" icon={Focus} onClick={() => viewRef.current?.fit()} disabled={empty} />
          <IconButton label="Auto-rotate" shortcut="R" icon={Rotate3d} active={autoRotate} onClick={() => onAutoRotate(!autoRotate)} />
          <IconButton label="Block outlines" shortcut="G" icon={Grid3x3} active={showEdges} onClick={() => onShowEdges(!showEdges)} />
          <IconButton label="Save a screenshot" icon={Camera} onClick={onScreenshot} disabled={empty} />
          <IconButton
            label={fullscreen ? 'Exit full screen' : 'Full screen'}
            icon={fullscreen ? Minimize : Maximize}
            onClick={toggleFullscreen}
          />
        </div>
      </div>

      {empty ? (
        <div className="viewer-empty">
          {loading ? (
            <>
              <span className="voxel-loader" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <p>Loading skin</p>
            </>
          ) : error ? (
            <>
              <TriangleAlert {...ICON} size={22} aria-hidden="true" />
              <p>{error}</p>
            </>
          ) : (
            <>
              <strong>Nothing to build yet</strong>
              <p>{model.warnings[0] ?? 'Drop a skin PNG anywhere on the page.'}</p>
            </>
          )}
        </div>
      ) : null}

      <div className="viewer-bottom">
        <Segmented
          label="Color mode"
          value={renderMode}
          onChange={onRenderMode}
          options={MODES}
          size="sm"
          stretch={false}
        />
        {renderMode === 'accuracy' && !empty ? <HeatLegend /> : null}
        <div className="layer-slider">
          <label htmlFor="viewer-layer">Layers</label>
          <input
            id="viewer-layer"
            type="range"
            min={0}
            max={Math.max(1, height)}
            value={sliderValue}
            disabled={empty}
            style={{ '--fill': `${height ? (sliderValue / height) * 100 : 100}%` }}
            onChange={(event) => {
              const value = Number(event.target.value)
              onLayerChange(value >= height ? null : value)
            }}
          />
          <output htmlFor="viewer-layer" className="mono">
            {layer == null ? 'All' : `${layer + 1}/${height}`}
          </output>
        </div>
      </div>
    </div>
  )
}

function HeatLegend() {
  const stops = [0, 4, 8, 12, 18].map((value) => `rgb(${heat(value).join(',')})`)
  return (
    <div className="heat-legend" aria-label="Match legend: close on the left, far on the right">
      <span>Close</span>
      <i style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }} />
      <span>Far</span>
    </div>
  )
}
