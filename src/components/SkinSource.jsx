import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, LoaderCircle, Search, Upload } from 'lucide-react'
import { renderFrontView, SAMPLE_SKINS } from '../lib/skinSources'
import { ICON } from './iconProps'

export function SkinDoll({ skin, className = '' }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (canvasRef.current) renderFrontView(skin, canvasRef.current)
  }, [skin])
  return <canvas ref={canvasRef} className={`skin-doll ${className}`} width={16} height={32} aria-hidden="true" />
}

const SOURCE_LABELS = {
  sample: 'Sample skin',
  file: 'Uploaded',
  paste: 'Pasted',
  username: 'Player skin',
  saved: 'Last session',
}

export function SkinSource({
  skin,
  source,
  skinType,
  samples,
  loading,
  onUploadClick,
  onSample,
  onUsername,
  onPaste,
}) {
  const [username, setUsername] = useState('')
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState(null)

  async function submitUsername(event) {
    event.preventDefault()
    if (!username.trim() || fetching) return
    setFetching(true)
    setError(null)
    try {
      await onUsername(username)
      setUsername('')
    } catch (reason) {
      setError(reason.message)
    } finally {
      setFetching(false)
    }
  }

  const displayName = skin ? skin.name.replace(/\.png$/i, '') : 'No skin yet'

  return (
    <div className="skin-source">
      <div className="skin-card">
        <div className="skin-card-art">
          {skin ? <SkinDoll skin={skin} /> : <div className="skin-doll is-empty" />}
          {loading ? <span className="skin-card-loading" aria-label="Loading skin" /> : null}
        </div>
        <div className="skin-card-copy">
          <strong title={displayName}>{displayName}</strong>
          <span>
            {skin
              ? `${skin.width}x${skin.height} · ${skinType === 'slim' ? 'Slim arms' : 'Classic arms'}`
              : 'Drop a PNG anywhere'}
          </span>
          {source ? <span className="skin-card-source">{SOURCE_LABELS[source] ?? source}</span> : null}
        </div>
      </div>

      <div className="skin-actions">
        <button type="button" className="button" onClick={onUploadClick} title="Open a skin file (O)">
          <Upload {...ICON} aria-hidden="true" />
          Upload PNG
        </button>
        <button type="button" className="button" onClick={onPaste} title="Paste an image (Ctrl+V)">
          <ClipboardPaste {...ICON} aria-hidden="true" />
          Paste
        </button>
      </div>

      <form className="username-form" onSubmit={submitUsername}>
        <label htmlFor="username-input" className="sr-only">
          Minecraft username
        </label>
        <div className={`input-with-button ${error ? 'has-error' : ''}`}>
          <input
            id="username-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck="false"
            placeholder="Load a player by username"
            value={username}
            maxLength={16}
            aria-describedby={error ? 'username-error' : undefined}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setUsername(event.target.value)
              if (error) setError(null)
            }}
          />
          <button type="submit" disabled={!username.trim() || fetching} aria-label="Load player skin">
            {fetching ? (
              <LoaderCircle {...ICON} className="spin" aria-hidden="true" />
            ) : (
              <Search {...ICON} aria-hidden="true" />
            )}
          </button>
        </div>
        {error ? (
          <p className="field-error" id="username-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      <div className="sample-row" role="group" aria-label="Sample skins">
        {SAMPLE_SKINS.map((sample) => {
          const loaded = samples[sample.id]
          const active = source === 'sample' && skin?.name === `${sample.name}.png`
          return (
            <button
              key={sample.id}
              type="button"
              className={`sample ${active ? 'is-active' : ''}`}
              onClick={() => onSample(sample)}
              aria-pressed={active}
              title={`Try ${sample.name}`}
            >
              {loaded ? <SkinDoll skin={loaded} /> : <span className="skin-doll is-empty" />}
              <span>{sample.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
