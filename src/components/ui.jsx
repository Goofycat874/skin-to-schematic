import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ICON } from './iconProps'

export function Section({ title, hint, children, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()
  const isOpen = !collapsible || open

  return (
    <section className="section">
      {collapsible ? (
        <button
          type="button"
          className="section-head is-button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
        >
          <h3>{title}</h3>
          {hint ? <span className="section-hint">{hint}</span> : null}
          <ChevronDown className="section-chevron" {...ICON} aria-hidden="true" />
        </button>
      ) : (
        <div className="section-head">
          <h3>{title}</h3>
          {hint ? <span className="section-hint">{hint}</span> : null}
        </div>
      )}
      {isOpen ? (
        <div className="section-body" id={contentId}>
          {children}
        </div>
      ) : null}
    </section>
  )
}

export function Field({ label, hint, children, htmlFor }) {
  return (
    <div className="field">
      <div className="field-label">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
        {hint ? <span className="field-hint">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}

export function Segmented({ value, options, onChange, label, size = 'md', stretch = true }) {
  return (
    <div
      className={`segmented size-${size} ${stretch ? 'is-stretch' : ''}`}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? 'is-selected' : ''}
            title={option.title}
            onClick={() => onChange(option.value)}
          >
            {option.icon ? <option.icon {...ICON} size={14} aria-hidden="true" /> : null}
            {option.label ? <span>{option.label}</span> : null}
            {option.sub ? <small>{option.sub}</small> : null}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label, description }) {
  const id = useId()
  return (
    <label className="switch-row" htmlFor={id}>
      <span className="switch-copy">
        <span>{label}</span>
        {description ? <small>{description}</small> : null}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
    </label>
  )
}

export function Slider({ label, value, min, max, step = 1, onChange, format, id: givenId }) {
  const autoId = useId()
  const id = givenId ?? autoId
  const percent = ((value - min) / (max - min)) * 100
  return (
    <div className="slider">
      <div className="slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="mono">
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${percent}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

export function Select({ value, onChange, options, label, id }) {
  return (
    <div className="select">
      <select
        id={id}
        aria-label={id ? undefined : label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown {...ICON} size={15} aria-hidden="true" />
    </div>
  )
}

export function IconButton({ label, icon: Icon, onClick, active, disabled, className = '', shortcut }) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'is-active' : ''} ${className}`}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon {...ICON} aria-hidden="true" />
    </button>
  )
}

export function Kbd({ children }) {
  return <kbd className="kbd">{children}</kbd>
}

export function Swatch({ color, size = 'md' }) {
  return (
    <span
      className={`swatch size-${size}`}
      style={{ backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }}
      aria-hidden="true"
    />
  )
}
