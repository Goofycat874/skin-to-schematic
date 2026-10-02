export function rgbToOklab(rgb) {
  const [r, g, b] = rgb.map((value) => srgbToLinear(value / 255))

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)

  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ]
}

export function oklabDistance(a, b) {
  const dl = a[0] - b[0]
  const da = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dl * dl + da * da + db * db) * 100
}

export function compositeRgba(overlay, base) {
  if (!base || overlay.a >= 255) return { ...overlay }

  const overlayAlpha = overlay.a / 255
  const baseAlpha = base.a / 255
  const outputAlpha = overlayAlpha + baseAlpha * (1 - overlayAlpha)
  if (outputAlpha === 0) return { r: 0, g: 0, b: 0, a: 0 }

  return {
    r: Math.round(
      (overlay.r * overlayAlpha + base.r * baseAlpha * (1 - overlayAlpha)) /
        outputAlpha,
    ),
    g: Math.round(
      (overlay.g * overlayAlpha + base.g * baseAlpha * (1 - overlayAlpha)) /
        outputAlpha,
    ),
    b: Math.round(
      (overlay.b * overlayAlpha + base.b * baseAlpha * (1 - overlayAlpha)) /
        outputAlpha,
    ),
    a: Math.round(outputAlpha * 255),
  }
}

function srgbToLinear(value) {
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4
}

export function oklabToRgb(lab) {
  const [L, a, b] = lab
  const lRoot = L + 0.3963377774 * a + 0.2158037573 * b
  const mRoot = L - 0.1055613458 * a - 0.0638541728 * b
  const sRoot = L - 0.0894841775 * a - 1.291485548 * b
  const l = lRoot ** 3
  const m = mRoot ** 3
  const s = sRoot ** 3

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((value) => clampByte(linearToSrgb(value) * 255))
}

export const NEUTRAL_TONE = { brightness: 0, contrast: 0, saturation: 0 }

export function isNeutralTone(tone) {
  return (
    !tone ||
    ((tone.brightness ?? 0) === 0 &&
      (tone.contrast ?? 0) === 0 &&
      (tone.saturation ?? 0) === 0)
  )
}

// Brightness, contrast, and saturation run in OKLab so hue stays put while
// lightness and chroma move. Inputs are -100..100 slider values.
export function adjustTone(color, tone) {
  if (isNeutralTone(tone)) return color

  const [L, a, b] = rgbToOklab([color.r, color.g, color.b])
  const brightness = (tone.brightness ?? 0) / 100
  const contrast = 1 + (tone.contrast ?? 0) / 100
  const saturation = Math.max(0, 1 + (tone.saturation ?? 0) / 100)
  const nextL = Math.min(1, Math.max(0, (L - 0.5) * contrast + 0.5 + brightness * 0.35))
  const [r, g, bl] = oklabToRgb([nextL, a * saturation, b * saturation])

  return { r, g, b: bl, a: color.a }
}

export function rgbToHex(rgb) {
  return `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function linearToSrgb(value) {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * clamped ** (1 / 2.4) - 0.055
}

function clampByte(value) {
  return Math.min(255, Math.max(0, Math.round(value)))
}
