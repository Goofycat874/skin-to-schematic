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
