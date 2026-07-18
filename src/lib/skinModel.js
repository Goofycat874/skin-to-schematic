import { compositeRgba } from './color.js'
import { getPalette, matchBlock } from './palettes.js'

const FACE_OFFSETS = {
  front: [0, 0, -1],
  back: [0, 0, 1],
  right: [-1, 0, 0],
  left: [1, 0, 0],
  top: [0, 1, 0],
  bottom: [0, -1, 0],
}

const BLOCK_FACES = {
  front: 'north',
  back: 'south',
  right: 'west',
  left: 'east',
  top: 'up',
  bottom: 'down',
}

const FACE_PRIORITY = {
  front: 60,
  back: 50,
  left: 40,
  right: 40,
  top: 30,
  bottom: 20,
}

const BASE_PARTS = {
  head: { x: 4, y: 24, z: 0, w: 8, h: 8, d: 8 },
  body: { x: 4, y: 12, z: 2, w: 8, h: 12, d: 4 },
  rightArm: { x: 0, y: 12, z: 2, w: 4, h: 12, d: 4 },
  leftArm: { x: 12, y: 12, z: 2, w: 4, h: 12, d: 4 },
  rightLeg: { x: 4, y: 0, z: 2, w: 4, h: 12, d: 4 },
  leftLeg: { x: 8, y: 0, z: 2, w: 4, h: 12, d: 4 },
}

const UV_64 = {
  head: cuboidUv(8, 8, 8, 0, 0),
  headOverlay: cuboidUv(8, 8, 8, 32, 0),
  body: cuboidUv(8, 12, 4, 16, 16),
  bodyOverlay: cuboidUv(8, 12, 4, 16, 32),
  rightArm: cuboidUv(4, 12, 4, 40, 16),
  rightArmOverlay: cuboidUv(4, 12, 4, 40, 32),
  leftArm: cuboidUv(4, 12, 4, 32, 48),
  leftArmOverlay: cuboidUv(4, 12, 4, 48, 48),
  rightLeg: cuboidUv(4, 12, 4, 0, 16),
  rightLegOverlay: cuboidUv(4, 12, 4, 0, 32),
  leftLeg: cuboidUv(4, 12, 4, 16, 48),
  leftLegOverlay: cuboidUv(4, 12, 4, 0, 48),
}

const UV_32 = {
  ...UV_64,
  leftArm: UV_64.rightArm,
  leftArmOverlay: null,
  leftLeg: UV_64.rightLeg,
  leftLegOverlay: null,
  bodyOverlay: null,
  rightArmOverlay: null,
  rightLegOverlay: null,
}

function cuboidUv(width, height, depth, u, v) {
  return {
    top: { x: u + depth, y: v, w: width, h: depth },
    bottom: { x: u + depth + width, y: v, w: width, h: depth },
    right: { x: u, y: v + depth, w: depth, h: height },
    front: { x: u + depth, y: v + depth, w: width, h: height },
    left: { x: u + depth + width, y: v + depth, w: depth, h: height },
    back: { x: u + depth + width + depth, y: v + depth, w: width, h: height },
  }
}

export function readSkinFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0)
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

      URL.revokeObjectURL(image.src)
      resolve({
        name: file.name,
        width: canvas.width,
        height: canvas.height,
        imageData,
        url: canvas.toDataURL('image/png'),
      })
    }
    image.onerror = () => reject(new Error('Could not read the skin image.'))
    image.src = URL.createObjectURL(file)
  })
}

export function buildSkinModel(skin, options) {
  if (!skin) return emptyModel(['Upload a 64x64 or 64x32 Minecraft skin PNG.'])

  const warnings = []
  if (skin.width !== 64 || (skin.height !== 64 && skin.height !== 32)) {
    warnings.push(
      `Expected a 64x64 modern skin or 64x32 legacy skin, got ${skin.width}x${skin.height}.`,
    )
  }

  const uv = skin.height === 32 ? UV_32 : UV_64
  const palette = getPalette(options.palette)
  const rawBlocks = new Map()
  const samplePixel = makeSampler(skin.imageData)

  addPart(rawBlocks, BASE_PARTS.head, uv.head, uv.headOverlay, samplePixel, palette, options)
  addPart(rawBlocks, BASE_PARTS.body, uv.body, uv.bodyOverlay, samplePixel, palette, options)
  addPart(rawBlocks, BASE_PARTS.rightArm, uv.rightArm, uv.rightArmOverlay, samplePixel, palette, options)
  addPart(rawBlocks, BASE_PARTS.leftArm, uv.leftArm, uv.leftArmOverlay, samplePixel, palette, options)
  addPart(rawBlocks, BASE_PARTS.rightLeg, uv.rightLeg, uv.rightLegOverlay, samplePixel, palette, options)
  addPart(rawBlocks, BASE_PARTS.leftLeg, uv.leftLeg, uv.leftLegOverlay, samplePixel, palette, options)

  if (rawBlocks.size === 0) {
    warnings.push('No visible pixels were converted. Check opacity and layer settings.')
  }
  if (options.palette === 'powder') {
    warnings.push('Concrete powder can fall after block updates.')
  }

  return scaleAndNormalize(rawBlocks, options.scale, warnings, palette)
}

function emptyModel(warnings) {
  return {
    blocks: [],
    width: 0,
    height: 0,
    length: 0,
    paletteStates: [],
    usedBlocks: [],
    averageMatchError: 0,
    warnings,
  }
}

function makeSampler(imageData) {
  return (x, y) => {
    if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) return null
    const index = (y * imageData.width + x) * 4
    return {
      r: imageData.data[index],
      g: imageData.data[index + 1],
      b: imageData.data[index + 2],
      a: imageData.data[index + 3],
    }
  }
}

function addPart(blocks, part, baseFaces, overlayFaces, samplePixel, palette, options) {
  if (!baseFaces) return

  for (const [face, baseRect] of Object.entries(baseFaces)) {
    const overlayRect = overlayFaces?.[face]
    for (let py = 0; py < baseRect.h; py += 1) {
      for (let px = 0; px < baseRect.w; px += 1) {
        const base = options.includeBase
          ? visiblePixel(samplePixel(baseRect.x + px, baseRect.y + py), options)
          : null
        const overlay = options.includeOverlay && overlayRect
          ? visiblePixel(samplePixel(overlayRect.x + px, overlayRect.y + py), options)
          : null

        if (options.overlayMode === 'shell') {
          if (base) addFacePixel(blocks, part, face, px, py, baseRect, base, palette, options, false)
          if (overlay) {
            const renderedOverlay = base ? compositeRgba(overlay, base) : overlay
            addFacePixel(
              blocks,
              part,
              face,
              px,
              py,
              overlayRect,
              renderedOverlay,
              palette,
              options,
              true,
            )
          }
          continue
        }

        const visible = overlay ? compositeRgba(overlay, base) : base
        if (visible) {
          addFacePixel(blocks, part, face, px, py, baseRect, visible, palette, options, false)
        }
      }
    }
  }
}

function visiblePixel(color, options) {
  return color && color.a >= options.alphaCutoff ? color : null
}

function addFacePixel(blocks, part, face, px, py, rect, color, palette, options, overlay) {
  const blockFace = BLOCK_FACES[face]
  const match = matchBlock(color, palette, blockFace)
  const positions = positionsForFace(part, face, px, py, rect, options, overlay)

  for (const position of positions) {
    const candidate = {
      ...position,
      state: match.block.state,
      label: match.block.label,
      legacyId: match.block.legacyId,
      legacyData: match.block.legacyData,
      color: match.rgb,
      sourceColor: [color.r, color.g, color.b, color.a],
      matchError: match.error,
      face,
      priority: FACE_PRIORITY[face] + (overlay ? 100 : 0),
    }
    const key = keyFor(position)
    const existing = blocks.get(key)
    if (
      !existing ||
      candidate.priority > existing.priority ||
      (candidate.priority === existing.priority && candidate.matchError < existing.matchError)
    ) {
      blocks.set(key, candidate)
    }
  }
}

function positionsForFace(part, face, px, py, rect, options, overlay) {
  const positions = []
  const [ox, oy, oz] = overlay ? FACE_OFFSETS[face] : [0, 0, 0]
  const maxDepth = overlay
    ? 1
    : Math.min(options.thickness, Math.ceil(Math.min(part.w, part.h, part.d) / 2))

  for (let inset = 0; inset < maxDepth; inset += 1) {
    const x1 = part.x + inset
    const x2 = part.x + part.w - 1 - inset
    const y1 = part.y + inset
    const y2 = part.y + part.h - 1 - inset
    const z1 = part.z + inset
    const z2 = part.z + part.d - 1 - inset
    const y = part.y + rect.h - 1 - py

    if (face === 'front') {
      positions.push({ x: part.x + px + ox, y, z: z1 + oz })
    } else if (face === 'back') {
      positions.push({ x: part.x + rect.w - 1 - px + ox, y, z: z2 + oz })
    } else if (face === 'right') {
      positions.push({ x: x1 + ox, y, z: part.z + rect.w - 1 - px + oz })
    } else if (face === 'left') {
      positions.push({ x: x2 + ox, y, z: part.z + px + oz })
    } else if (face === 'top') {
      positions.push({ x: part.x + px + ox, y: y2 + oy, z: part.z + py + oz })
    } else if (face === 'bottom') {
      positions.push({
        x: part.x + px + ox,
        y: y1 + oy,
        z: part.z + rect.h - 1 - py + oz,
      })
    }
  }
  return positions
}

function scaleAndNormalize(rawBlocks, scale, warnings, palette) {
  const values = [...rawBlocks.values()]
  if (values.length === 0) return emptyModel(warnings)

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY

  for (const block of values) {
    minX = Math.min(minX, block.x)
    minY = Math.min(minY, block.y)
    minZ = Math.min(minZ, block.z)
    maxX = Math.max(maxX, block.x)
    maxY = Math.max(maxY, block.y)
    maxZ = Math.max(maxZ, block.z)
  }

  const scaled = []
  for (const block of values) {
    const baseX = (block.x - minX) * scale
    const baseY = (block.y - minY) * scale
    const baseZ = (block.z - minZ) * scale
    for (let sx = 0; sx < scale; sx += 1) {
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sz = 0; sz < scale; sz += 1) {
          scaled.push({ ...block, x: baseX + sx, y: baseY + sy, z: baseZ + sz })
        }
      }
    }
  }

  const usage = new Map()
  for (const block of values) {
    const current = usage.get(block.state) ?? {
      state: block.state,
      label: block.label,
      color: block.color,
      count: 0,
    }
    current.count += 1
    usage.set(block.state, current)
  }

  return {
    blocks: scaled,
    width: (maxX - minX + 1) * scale,
    height: (maxY - minY + 1) * scale,
    length: (maxZ - minZ + 1) * scale,
    paletteStates: [...usage.keys()],
    usedBlocks: [...usage.values()].sort((a, b) => b.count - a.count),
    averageMatchError:
      values.reduce((sum, block) => sum + block.matchError, 0) / values.length,
    paletteLabel: palette.label,
    warnings,
  }
}

function keyFor({ x, y, z }) {
  return `${x},${y},${z}`
}
