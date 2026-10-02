const HEAT_STOPS = [
  [0, [46, 196, 150]],
  [5, [180, 230, 70]],
  [10, [245, 190, 60]],
  [18, [240, 80, 64]],
]

// Maps a color-match error (OKLab distance x100) onto a green-to-red ramp.
export function heat(error) {
  if (error <= HEAT_STOPS[0][0]) return HEAT_STOPS[0][1]
  for (let index = 1; index < HEAT_STOPS.length; index += 1) {
    const [stop, rgb] = HEAT_STOPS[index]
    if (error <= stop) {
      const [prevStop, prevRgb] = HEAT_STOPS[index - 1]
      const t = (error - prevStop) / (stop - prevStop)
      return prevRgb.map((value, channel) => Math.round(value + (rgb[channel] - value) * t))
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1][1]
}

export function blockDisplayColor(block, mode) {
  if (mode === 'skin') return block.sourceColor
  if (mode === 'accuracy') {
    if (block.kind !== 'skin') return [120, 124, 130]
    return heat(block.matchError)
  }
  return block.color
}
