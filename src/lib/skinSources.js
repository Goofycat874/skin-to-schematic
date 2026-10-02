import { normalizeSkinImage, readSkinFile, detectSkinModel } from './skinModel.js'

const base = import.meta.env?.BASE_URL ?? '/'

export const SAMPLE_SKINS = [
  { id: 'pathfinder', name: 'Pathfinder', url: `${base}samples/pathfinder.png` },
  { id: 'neon', name: 'Neon', url: `${base}samples/neon.png` },
  { id: 'moss-knight', name: 'Moss Knight', url: `${base}samples/moss-knight.png` },
  { id: 'astro', name: 'Astro', url: `${base}samples/astro.png` },
]

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/

// Public skin mirrors that serve raw skin textures with CORS headers.
const USERNAME_SOURCES = [
  (name) => `https://mc-heads.net/skin/${encodeURIComponent(name)}`,
  (name) => `https://minotar.net/skin/${encodeURIComponent(name)}`,
]

export function isPngFile(file) {
  return Boolean(file) && (file.type === 'image/png' || /\.png$/i.test(file.name ?? ''))
}

export async function loadSkinFromUrl(url, name) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load ${name} (${response.status}).`)
  const blob = await response.blob()
  return readSkinFile(new File([blob], name, { type: blob.type || 'image/png' }))
}

export async function fetchSkinByUsername(rawName) {
  const name = rawName.trim()
  if (!USERNAME_PATTERN.test(name)) {
    throw new Error('Usernames are 3 to 16 letters, numbers, or underscores.')
  }

  let lastError = null
  for (const source of USERNAME_SOURCES) {
    try {
      const skin = await loadSkinFromUrl(source(name), `${name}.png`)
      if (skin.width === 64 && (skin.height === 64 || skin.height === 32)) return skin
      lastError = new Error('That server returned something that is not a skin.')
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(
    lastError?.message?.startsWith('Could not load')
      ? `No skin found for ${name}. Check the spelling, or download the PNG and drop it here.`
      : `Skin servers could not be reached for ${name}. Download the PNG and drop it here instead.`,
  )
}

// Paints a flat front view (head, body, arms, legs) of a skin, base layer
// first with the overlay on top. Returns a 16x32 canvas.
export function renderFrontView(skin, canvas = document.createElement('canvas')) {
  canvas.width = 16
  canvas.height = 32
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, 16, 32)
  if (!skin?.imageData) return canvas

  const { imageData } = normalizeSkinImage(skin)
  const slim = detectSkinModel(skin) === 'slim'
  const arm = slim ? 3 : 4
  const output = context.createImageData(16, 32)

  const blit = (sx, sy, w, h, dx, dy) => {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const from = ((sy + y) * imageData.width + sx + x) * 4
        const alpha = imageData.data[from + 3]
        if (alpha === 0) continue
        const to = ((dy + y) * 16 + dx + x) * 4
        const a = alpha / 255
        for (let channel = 0; channel < 3; channel += 1) {
          output.data[to + channel] = Math.round(
            imageData.data[from + channel] * a + output.data[to + channel] * (1 - a),
          )
        }
        output.data[to + 3] = Math.max(output.data[to + 3], alpha)
      }
    }
  }

  const layers = [
    // [base x, base y, overlay x, overlay y, width, height, dest x, dest y]
    [8, 8, 40, 8, 8, 8, 4, 0],
    [20, 20, 20, 36, 8, 12, 4, 8],
    [44, 20, 44, 36, arm, 12, 4 - arm, 8],
    [36, 52, 52, 52, arm, 12, 12, 8],
    [4, 20, 4, 36, 4, 12, 4, 20],
    [20, 52, 4, 52, 4, 12, 8, 20],
  ]
  for (const [bx, by, , , w, h, dx, dy] of layers) blit(bx, by, w, h, dx, dy)
  for (const [, , ox, oy, w, h, dx, dy] of layers) blit(ox, oy, w, h, dx, dy)

  context.putImageData(output, 0, 0)
  return canvas
}
