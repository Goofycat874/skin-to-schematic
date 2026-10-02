import {
  Accessibility,
  Footprints,
  Ghost,
  Hand,
  PersonStanding,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import {
  BLOCK_FILTERS,
  FILLER_BLOCKS,
  PEDESTAL_BLOCKS,
  getPalette,
  paletteOptions,
} from '../lib/palettes'
import { axisLabel, JOINT_AXES, JOINT_LABELS, JOINTS, POSES, resolvePose } from '../lib/poses'
import { MAX_SCALE } from '../lib/skinModel'
import { ICON } from './iconProps'
import { Field, Section, Segmented, Select, Slider, Switch } from './ui'

const POSE_ICONS = {
  stand: PersonStanding,
  walk: Footprints,
  wave: Hand,
  hero: Trophy,
  tpose: Accessibility,
  zombie: Ghost,
  dab: Sparkles,
  custom: SlidersHorizontal,
}

const AXIS_RANGES = {
  head: { pitch: [-60, 60], yaw: [-80, 80], roll: [-40, 40] },
  limb: { pitch: [-180, 180], roll: [-30, 180], yaw: [-90, 90] },
  leg: { pitch: [-110, 110], roll: [-20, 60], yaw: [-45, 45] },
}

export function ControlPanel({ options, setOption, setOptions, detectedModel, resetOptions }) {
  const palette = getPalette(options.palette, {
    filters: options.filters,
    excluded: options.excludedBlocks,
  })
  const activePalette = paletteOptions.find((entry) => entry.id === options.palette)

  return (
    <>
      <Section title="Model and pose" hint={options.pose === 'custom' ? 'Custom' : null}>
        <Field label="Arms">
          <Segmented
            label="Arm width"
            value={options.skinModel}
            onChange={(value) => setOption('skinModel', value)}
            options={[
              { value: 'auto', label: 'Auto', sub: detectedModel === 'slim' ? 'Slim' : 'Classic' },
              { value: 'classic', label: 'Classic', sub: '4 px' },
              { value: 'slim', label: 'Slim', sub: '3 px' },
            ]}
          />
        </Field>
        <Field label="Pose">
          <div className="pose-grid" role="radiogroup" aria-label="Pose">
            {[...POSES, { id: 'custom', label: 'Custom' }].map((pose) => {
              const Icon = POSE_ICONS[pose.id]
              const selected = options.pose === pose.id
              return (
                <button
                  key={pose.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`pose-chip ${selected ? 'is-selected' : ''}`}
                  onClick={() => {
                    if (pose.id === 'custom') {
                      setOptions((current) => ({
                        ...current,
                        pose: 'custom',
                        customPose:
                          current.pose === 'custom' ? current.customPose : resolvePose(current),
                      }))
                    } else {
                      setOption('pose', pose.id)
                    }
                  }}
                >
                  <Icon {...ICON} size={17} aria-hidden="true" />
                  <span>{pose.label}</span>
                </button>
              )
            })}
          </div>
        </Field>
        {options.pose === 'custom' ? (
          <PoseEditor options={options} setOptions={setOptions} />
        ) : null}
      </Section>

      <Section
        title="Blocks"
        hint={`${palette.blocks.length} of ${palette.totalCount} in use`}
      >
        <div className="palette-grid" role="radiogroup" aria-label="Block palette">
          {paletteOptions.map((entry) => {
            const selected = entry.id === options.palette
            return (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`palette-card ${selected ? 'is-selected' : ''}`}
                onClick={() => setOption('palette', entry.id)}
                title={entry.description}
              >
                <span className="palette-strip" aria-hidden="true">
                  {entry.swatches.map((rgb, index) => (
                    <i key={index} style={{ backgroundColor: `rgb(${rgb.join(',')})` }} />
                  ))}
                </span>
                <span className="palette-name">{entry.label}</span>
                <span className="palette-count mono">{entry.count}</span>
              </button>
            )
          })}
        </div>
        <p className="help-text">{activePalette?.description}</p>

        {activePalette?.supportsFilters ? (
          <Field label="Skip these blocks" hint={`${palette.filteredOut} skipped`}>
            <div className="chip-row">
              {BLOCK_FILTERS.map((filter) => {
                const active = options.filters.includes(filter.id)
                return (
                  <button
                    key={filter.id}
                    type="button"
                    className={`chip ${active ? 'is-selected' : ''}`}
                    aria-pressed={active}
                    title={filter.description}
                    onClick={() =>
                      setOption(
                        'filters',
                        active
                          ? options.filters.filter((id) => id !== filter.id)
                          : [...options.filters, filter.id],
                      )
                    }
                  >
                    {filter.label}
                  </button>
                )
              })}
            </div>
          </Field>
        ) : null}

        {options.excludedBlocks.length ? (
          <div className="banned-note">
            <span>
              {options.excludedBlocks.length} block{options.excludedBlocks.length === 1 ? '' : 's'}{' '}
              banned by you
            </span>
            <button type="button" className="text-button" onClick={() => setOption('excludedBlocks', [])}>
              <X {...ICON} size={14} aria-hidden="true" />
              Clear
            </button>
          </div>
        ) : null}
      </Section>

      <Section title="Build">
        <Field label="Size" hint={`${32 * options.scale} blocks tall`}>
          <Segmented
            label="Size"
            value={options.scale}
            onChange={(value) => setOption('scale', value)}
            options={Array.from({ length: MAX_SCALE }, (_, index) => ({
              value: index + 1,
              label: `${index + 1}x`,
            }))}
          />
        </Field>
        <Field label="Overlay layer" hint="Hats, jackets, sleeves">
          <Segmented
            label="Overlay layer"
            value={options.includeOverlay ? options.overlayMode : 'off'}
            onChange={(value) =>
              setOptions((current) => ({
                ...current,
                includeOverlay: value !== 'off',
                overlayMode: value === 'off' ? current.overlayMode : value,
              }))
            }
            options={[
              { value: 'off', label: 'Off' },
              { value: 'flatten', label: 'Merged' },
              { value: 'shell', label: '3D layer' },
            ]}
          />
        </Field>
        {options.includeOverlay && options.overlayMode === 'shell' ? (
          <Switch
            label="Seal overlay edges"
            description="Fill the corners where two overlay faces meet"
            checked={options.sealSeams}
            onChange={(value) => setOption('sealSeams', value)}
          />
        ) : null}
        <Field label="Shell" hint="Colored layers from the outside in">
          <Segmented
            label="Shell depth"
            value={options.thickness}
            onChange={(value) => setOption('thickness', value)}
            options={[1, 2, 3].map((value) => ({
              value,
              label: `${value} block${value > 1 ? 's' : ''}`,
            }))}
          />
        </Field>
        <Field label="Inside">
          <Segmented
            label="Interior"
            value={options.interior}
            onChange={(value) => setOption('interior', value)}
            options={[
              { value: 'hollow', label: 'Hollow' },
              { value: 'filled', label: 'Filled' },
            ]}
          />
        </Field>
        {options.interior === 'filled' ? (
          <Field label="Filler block" htmlFor="filler-select">
            <Select
              id="filler-select"
              value={options.fillerBlock}
              onChange={(value) => setOption('fillerBlock', value)}
              options={FILLER_BLOCKS.map((block) => ({ value: block.state, label: block.label }))}
            />
          </Field>
        ) : null}
        <Switch
          label="Pedestal"
          description="A base slab under the feet"
          checked={options.pedestal}
          onChange={(value) => setOption('pedestal', value)}
        />
        {options.pedestal ? (
          <Field label="Pedestal block" htmlFor="pedestal-select">
            <Select
              id="pedestal-select"
              value={options.pedestalBlock}
              onChange={(value) => setOption('pedestalBlock', value)}
              options={PEDESTAL_BLOCKS.map((block) => ({ value: block.state, label: block.label }))}
            />
          </Field>
        ) : null}
      </Section>

      <Section title="Color tuning" collapsible defaultOpen={false}>
        <Slider
          label="Brightness"
          min={-50}
          max={50}
          value={options.tone.brightness}
          format={signed}
          onChange={(value) => setOption('tone', { ...options.tone, brightness: value })}
        />
        <Slider
          label="Contrast"
          min={-50}
          max={50}
          value={options.tone.contrast}
          format={signed}
          onChange={(value) => setOption('tone', { ...options.tone, contrast: value })}
        />
        <Slider
          label="Saturation"
          min={-100}
          max={100}
          value={options.tone.saturation}
          format={signed}
          onChange={(value) => setOption('tone', { ...options.tone, saturation: value })}
        />
        <Slider
          label="Transparency cutoff"
          min={1}
          max={254}
          value={options.alphaCutoff}
          format={(value) => `${Math.round((value / 255) * 100)}%`}
          onChange={(value) => setOption('alphaCutoff', value)}
        />
        <button
          type="button"
          className="text-button"
          onClick={() =>
            setOptions((current) => ({
              ...current,
              tone: { brightness: 0, contrast: 0, saturation: 0 },
              alphaCutoff: 24,
            }))
          }
        >
          <RotateCcw {...ICON} size={14} aria-hidden="true" />
          Reset colors
        </button>
      </Section>

      <div className="panel-footer">
        <button type="button" className="text-button" onClick={resetOptions}>
          <RotateCcw {...ICON} size={14} aria-hidden="true" />
          Reset all settings
        </button>
      </div>
    </>
  )
}

function PoseEditor({ options, setOptions }) {
  const joints = resolvePose(options)

  function update(joint, axis, value) {
    setOptions((current) => {
      const resolved = resolvePose(current)
      return {
        ...current,
        pose: 'custom',
        customPose: { ...resolved, [joint]: { ...resolved[joint], [axis]: value } },
      }
    })
  }

  return (
    <div className="pose-editor">
      {JOINTS.map((joint) => {
        const ranges = joint === 'head' ? AXIS_RANGES.head : joint.endsWith('Leg') ? AXIS_RANGES.leg : AXIS_RANGES.limb
        return (
          <fieldset key={joint} className="pose-joint">
            <legend>{JOINT_LABELS[joint]}</legend>
            {JOINT_AXES[joint].map((axis) => (
              <Slider
                key={axis}
                label={axisLabel(joint, axis)}
                min={ranges[axis][0]}
                max={ranges[axis][1]}
                value={joints[joint][axis]}
                format={(value) => `${value}°`}
                onChange={(value) => update(joint, axis, value)}
              />
            ))}
          </fieldset>
        )
      })}
    </div>
  )
}

function signed(value) {
  return value > 0 ? `+${value}` : `${value}`
}
