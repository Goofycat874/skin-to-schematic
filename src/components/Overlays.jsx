import { useEffect, useRef } from 'react'
import { CircleCheck, Info, TriangleAlert, Upload, X } from 'lucide-react'
import { ICON } from './iconProps'
import { Kbd } from './ui'

const TOAST_ICONS = { success: CircleCheck, error: TriangleAlert, info: Info }

export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = TOAST_ICONS[toast.tone] ?? Info
        return (
          <div key={toast.id} className={`toast is-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
            <Icon {...ICON} aria-hidden="true" />
            <p>{toast.message}</p>
            <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
              <X {...ICON} size={14} aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function DropOverlay({ visible }) {
  if (!visible) return null
  return (
    <div className="drop-overlay" aria-hidden="true">
      <div className="drop-target">
        <Upload {...ICON} size={28} />
        <strong>Drop to load the skin</strong>
        <span>64x64 or legacy 64x32 PNG</span>
      </div>
    </div>
  )
}

const SHORTCUTS = [
  ['O', 'Open a skin file'],
  ['Ctrl V', 'Paste a skin image'],
  ['E', 'Export'],
  ['1 to 5', 'Front, side, back, top, 3D views'],
  ['F', 'Frame the statue'],
  ['R', 'Auto-rotate'],
  ['G', 'Block outlines'],
  ['M', 'Cycle Blocks, Skin, Match colors'],
  ['[ and ]', 'Step through layers'],
  ['Esc', 'Show every layer'],
  ['?', 'This list'],
]

export function ShortcutsDialog({ open, onClose }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      aria-labelledby="shortcuts-title"
    >
      <div className="dialog-head">
        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          <X {...ICON} aria-hidden="true" />
        </button>
      </div>
      <dl className="shortcut-list">
        {SHORTCUTS.map(([keys, label]) => (
          <div key={keys}>
            <dt>
              {keys.split(' ').map((key) =>
                ['to', 'and'].includes(key) ? (
                  <span key={key}> {key} </span>
                ) : (
                  <Kbd key={key}>{key}</Kbd>
                ),
              )}
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
    </dialog>
  )
}
