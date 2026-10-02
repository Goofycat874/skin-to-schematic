import { adjustTone, compositeRgba } from './color.js'
import {
  DEFAULT_FILTERS,
  FILLER_BLOCKS,
  PEDESTAL_BLOCKS,
  getPalette,
  matchBlock,
} from './palettes.js'
import { applyMatrix, isIdentity, jointMatrix, resolvePose, transpose } from './poses.js'

export const DEFAULT_OPTIONS = {
  palette: 'mixed',
  filters: DEFAULT_FILTERS,
  excludedBlocks: [],
  skinModel: 'auto',
  pose: 'stand',
  customPose: {},
  scale: 1,
  thickness: 1,
  interior: 'hollow',
  fillerBlock: 'minecraft:stone',
  includeBase: true,
  includeOverlay: true,
  overlayMode: 'flatten',
  sealSeams: true,
  pedestal: false,
  pedestalBlock: 'minecraft:polished_andesite',
  alphaCutoff: 24,
  tone: { brightness: 0, contrast: 0, saturation: 0 },
}

export const MAX_SCALE = 4
export const SOLID_THICKNESS = 99

const FACES = ['front', 'back', 'right', 'left', 'top', 'bottom']

const FACE_NORMALS = {
  front: [0, 0, -1],
  back: [0, 0, 1],
  right: [-1, 0, 0],
  left: [1, 0, 0],
  top: [0, 1, 0],
  bottom: [0, -1, 0],
}

const FACE_PRIORITY = {
  front: 60,
  back: 50,
  left: 40,
  right: 40,
  top: 30,
  bottom: 20,
}

// Layer ranks decide who owns a voxel when parts overlap: solid base layers
// beat overlay pixels, which beat synthesized overlay seam voxels.
const RANK_BASE = 3
const RANK_OVERLAY = 2
const RANK_SEAM = 1

const PART_ORDER = ['rightLeg', 'leftLeg', 'body', 'head', 'rightArm', 'leftArm']

const PART_BOXES = {
  classic: {
    head: { x: 4, y: 24, z: 0, w: 8, h: 8, d: 8 },
    body: { x: 4, y: 12, z: 2, w: 8, h: 12, d: 4 },
    rightArm: { x: 0, y: 12, z: 2, w: 4, h: 12, d: 4 },
    leftArm: { x: 12, y: 12, z: 2, w: 4, h: 12, d: 4 },
    rightLeg: { x: 4, y: 0, z: 2, w: 4, h: 12, d: 4 },
    leftLeg: { x: 8, y: 0, z: 2, w: 4, h: 12, d: 4 },
  },
  slim: {
    head: { x: 4, y: 24, z: 0, w: 8, h: 8, d: 8 },
    body: { x: 4, y: 12, z: 2, w: 8, h: 12, d: 4 },
    rightArm: { x: 1, y: 12, z: 2, w: 3, h: 12, d: 4 },
    leftArm: { x: 12, y: 12, z: 2, w: 3, h: 12, d: 4 },
    rightLeg: { x: 4, y: 0, z: 2, w: 4, h: 12, d: 4 },
    leftLeg: { x: 8, y: 0, z: 2, w: 4, h: 12, d: 4 },
  },
}

// Joint pivots in model space, matching the vanilla player model.
const PIVOTS = {
  head: [8, 24, 4],
  body: [8, 12, 4],
  rightArm: [3, 22, 4],
  leftArm: [13, 22, 4],
  rightLeg: [6, 12, 4],
  leftLeg: [10, 12, 4],
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

function skinUv(armWidth) {
  return {
    head: [cuboidUv(8, 8, 8, 0, 0), cuboidUv(8, 8, 8, 32, 0)],
    body: [cuboidUv(8, 12, 4, 16, 16), cuboidUv(8, 12, 4, 16, 32)],
    rightArm: [cuboidUv(armWidth, 12, 4, 40, 16), cuboidUv(armWidth, 12, 4, 40, 32)],
    leftArm: [cuboidUv(armWidth, 12, 4, 32, 48), cuboidUv(armWidth, 12, 4, 48, 48)],
    rightLeg: [cuboidUv(4, 12, 4, 0, 16), cuboidUv(4, 12, 4, 0, 32)],
    leftLeg: [cuboidUv(4, 12, 4, 16, 48), cuboidUv(4, 12, 4, 0, 48)],
  }
}

const UV = { classic: skinUv(4), slim: skinUv(3) }

export function readSkinFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      try {
        resolve(skinFromImage(image, file.name ?? 'skin.png'))
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read that image. Use a PNG skin file.'))
    }
    image.src = objectUrl
  })
}

export function skinFromImage(image, name) {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height) throw new Error('That image is empty.')
  if (width > 1024 || height > 1024) {
    throw new Error(`That image is ${width}x${height}. Skins are 64x64 or 64x32.`)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0)
  const imageData = context.getImageData(0, 0, width, height)

  return {
    name,
    width,
    height,
    imageData,
    url: canvas.toDataURL('image/png'),
  }
}

// Detects the 3px "slim" arm model: the classic arm columns that slim skins
// leave unused are fully transparent.
export function detectSkinModel(skin) {
  if (!skin || skin.height !== 64 || skin.width !== 64) return 'classic'
  const { data, width } = skin.imageData
  let transparent = 0
  let total = 0
  for (const [x0, y0, w, h] of [
    [54, 20, 2, 12],
    [50, 16, 2, 4],
  ]) {
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) {
        total += 1
        if (data[(y * width + x) * 4 + 3] === 0) transparent += 1
      }
    }
  }
  if (transparent !== total) return 'classic'

  // A fully transparent arm says nothing about the model.
  const armHasPixels = [44, 45, 46].some((x) =>
    [20, 24, 28].some((y) => data[(y * width + x) * 4 + 3] > 0),
  )
  return armHasPixels ? 'slim' : 'classic'
}

// Converts a legacy 64x32 skin to the modern layout the way the game does:
// limb textures are mirrored into the left-limb slots and an all-opaque hat
// layer is treated as transparent.
export function normalizeSkinImage(skin) {
  if (skin.width === 64 && skin.height === 32) {
    const data = new Uint8ClampedArray(64 * 64 * 4)
    data.set(skin.imageData.data.subarray(0, 64 * 32 * 4))
    const image = { width: 64, height: 64, data }
    const copies = [
      [4, 16, 16, 32, 4, 4],
      [8, 16, 16, 32, 4, 4],
      [0, 20, 24, 32, 4, 12],
      [4, 20, 16, 32, 4, 12],
      [8, 20, 8, 32, 4, 12],
      [12, 20, 16, 32, 4, 12],
      [44, 16, -8, 32, 4, 4],
      [48, 16, -8, 32, 4, 4],
      [40, 20, 0, 32, 4, 12],
      [44, 20, -8, 32, 4, 12],
      [48, 20, -16, 32, 4, 12],
      [52, 20, -8, 32, 4, 12],
    ]
    for (const [sx, sy, ox, oy, w, h] of copies) copyRectFlipped(image, sx, sy, ox, oy, w, h)
    clearIfOpaque(image, 32, 0, 64, 16)
    return { imageData: image, legacy: true }
  }
  return { imageData: skin.imageData, legacy: false }
}

function copyRectFlipped(image, sx, sy, ox, oy, w, h) {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const from = ((sy + y) * image.width + sx + x) * 4
      const to = ((sy + oy + y) * image.width + sx + ox + w - 1 - x) * 4
      for (let channel = 0; channel < 4; channel += 1) {
        image.data[to + channel] = image.data[from + channel]
      }
    }
  }
}

function clearIfOpaque(image, x0, y0, x1, y1) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3] < 128) return
    }
  }
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) image.data[(y * image.width + x) * 4 + 3] = 0
  }
}

export function buildSkinModel(skin, inputOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...inputOptions }
  if (!skin) return emptyModel(['Upload a 64x64 or 64x32 Minecraft skin PNG.'])

  const warnings = []
  if (skin.width !== 64 || (skin.height !== 64 && skin.height !== 32)) {
    warnings.push(
      `Expected a 64x64 modern skin or 64x32 legacy skin, got ${skin.width}x${skin.height}.`,
    )
  }

  const { imageData, legacy } = normalizeSkinImage(skin)
  const detectedModel = detectSkinModel(skin)
  const skinType = options.skinModel === 'auto' ? detectedModel : options.skinModel
  const uv = UV[skinType] ?? UV.classic
  const boxes = PART_BOXES[skinType] ?? PART_BOXES.classic
  const palette = getPalette(options.palette, {
    filters: options.filters ?? [],
    excluded: options.excludedBlocks ?? [],
  })
  if (palette.fallback) {
    warnings.push('Every block in this palette is excluded, so exclusions were ignored.')
  }

  const scale = clampInt(options.scale, 1, MAX_SCALE)
  const thickness = clampInt(options.thickness, 1, SOLID_THICKNESS)
  const sampler = makeSampler(imageData)
  const pose = resolvePose(options)
  const context = { options, sampler, records: [] }

  const parts = PART_ORDER.map((name, order) => {
    const [baseUv, overlayUv] = uv[name]
    const box = boxes[name]
    const matrix = name === 'body' ? IDENTITY : jointMatrix(name, pose[name])
    const hasOverlay =
      options.includeOverlay &&
      options.overlayMode === 'shell' &&
      !(legacy && name !== 'head')
    return buildPart(context, {
      name,
      order,
      box,
      baseUv,
      overlayUv: legacy && name !== 'head' ? null : overlayUv,
      hasOverlay,
      matrix,
      pivot: PIVOTS[name],
    })
  })

  const grid = rasterize(parts, scale)
  if (!grid) {
    warnings.push('No visible pixels were converted. Check opacity and layer settings.')
    return emptyModel(warnings, { skinType, detectedModel, palette })
  }

  const depth = surfaceDepth(grid, thickness)
  const fillerBlock =
    FILLER_BLOCKS.find((block) => block.state === options.fillerBlock) ?? FILLER_BLOCKS[0]
  const pedestalBlock =
    PEDESTAL_BLOCKS.find((block) => block.state === options.pedestalBlock) ??
    PEDESTAL_BLOCKS[0]
  const filled = options.interior === 'filled'

  // Cells are visited in y, z, x order, so blocks come out layer-sorted.
  const { cells, width: W, height: H, length: L } = grid
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  let solidCount = 0
  let keptCount = 0
  for (let y = 0, index = 0; y < H; y += 1) {
    for (let z = 0; z < L; z += 1) {
      for (let x = 0; x < W; x += 1, index += 1) {
        if (cells[index] < 0) continue
        solidCount += 1
        if (depth[index] > thickness && !filled) continue
        keptCount += 1
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (z < minZ) minZ = z
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
        if (z > maxZ) maxZ = z
      }
    }
  }

  if (keptCount === 0) {
    warnings.push('No visible pixels were converted. Check opacity and layer settings.')
    return emptyModel(warnings, { skinType, detectedModel, palette })
  }

  const pedestalHeight = options.pedestal ? scale : 0
  const pedestalMargin = options.pedestal ? Math.max(1, scale) : 0
  const width = maxX - minX + 1 + pedestalMargin * 2
  const length = maxZ - minZ + 1 + pedestalMargin * 2
  const height = maxY - minY + 1 + pedestalHeight
  const blocks = []
  let errorSum = 0
  let errorCount = 0
  let worstError = 0
  let fillerCount = 0

  if (options.pedestal) {
    for (let y = 0; y < pedestalHeight; y += 1) {
      for (let z = 0; z < length; z += 1) {
        for (let x = 0; x < width; x += 1) {
          blocks.push(staticBlock(x, y, z, pedestalBlock, 'pedestal'))
        }
      }
    }
  }

  for (let y = minY; y <= maxY; y += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const index = (y * L + z) * W + x
        const recordId = cells[index]
        if (recordId < 0) continue
        const interior = depth[index] > thickness
        if (interior && !filled) continue
        const record = context.records[recordId]
        const bx = x - minX + pedestalMargin
        const by = y - minY + pedestalHeight
        const bz = z - minZ + pedestalMargin

        if (interior) {
          blocks.push(staticBlock(bx, by, bz, fillerBlock, 'filler', record))
          fillerCount += 1
          continue
        }

        const match = matchBlock(record.color, palette, record.blockFace)
        errorSum += match.error
        errorCount += 1
        if (match.error > worstError) worstError = match.error
        blocks.push({
          x: bx,
          y: by,
          z: bz,
          state: match.block.state,
          label: match.block.label,
          legacyId: match.block.legacyId,
          legacyData: match.block.legacyData,
          color: match.rgb,
          sourceColor: record.sourceColor,
          matchError: match.error,
          face: record.face,
          blockFace: record.blockFace,
          part: record.part,
          kind: 'skin',
        })
      }
    }
  }

  const usage = new Map()
  for (const block of blocks) {
    const current = usage.get(block.state)
    if (current) current.count += 1
    else {
      usage.set(block.state, {
        state: block.state,
        label: block.label,
        color: block.color,
        count: 1,
        kind: block.kind,
      })
    }
  }

  if (options.palette === 'powder') {
    warnings.push('Concrete powder falls when nothing supports it. Build it bottom-up.')
  }
  if (legacy) {
    warnings.push('Legacy 64x32 skin: left limbs mirror the right ones, like in game.')
  }

  return {
    blocks,
    width,
    height,
    length,
    paletteStates: [...usage.keys()],
    usedBlocks: [...usage.values()].sort((a, b) => b.count - a.count),
    averageMatchError: errorCount ? errorSum / errorCount : 0,
    worstMatchError: worstError,
    paletteLabel: palette.label,
    paletteSize: palette.blocks.length,
    skinType,
    detectedModel,
    stats: {
      solidVolume: solidCount,
      skinBlocks: errorCount,
      hiddenRemoved: filled ? 0 : solidCount - errorCount,
      fillerBlocks: fillerCount,
      pedestalBlocks: options.pedestal ? width * length * pedestalHeight : 0,
    },
    warnings,
  }
}

function staticBlock(x, y, z, block, kind, record) {
  return {
    x,
    y,
    z,
    state: block.state,
    label: block.label,
    legacyId: block.legacyId,
    legacyData: block.legacyData,
    color: block.rgb,
    sourceColor: record ? record.sourceColor : [...block.rgb, 255],
    matchError: 0,
    face: record?.face ?? 'top',
    blockFace: 'up',
    part: record?.part ?? kind,
    kind,
  }
}

function emptyModel(warnings, extra = {}) {
  return {
    blocks: [],
    width: 0,
    height: 0,
    length: 0,
    paletteStates: [],
    usedBlocks: [],
    averageMatchError: 0,
    worstMatchError: 0,
    paletteLabel: extra.palette?.label,
    paletteSize: extra.palette?.blocks.length ?? 0,
    skinType: extra.skinType ?? 'classic',
    detectedModel: extra.detectedModel ?? 'classic',
    stats: { solidVolume: 0, skinBlocks: 0, hiddenRemoved: 0, fillerBlocks: 0, pedestalBlocks: 0 },
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

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]

// Builds the colored voxels of one body part in its local box space.
// Base voxels fill the whole box (hollowing happens later on the posed,
// scaled statue). Each base voxel takes its color from the nearest face.
function buildPart(context, spec) {
  const { box, baseUv, overlayUv, hasOverlay, matrix, name, order } = spec
  const { options, sampler, records } = context
  const { w, h, d } = box
  const faceToBlockFace = blockFacesFor(matrix)

  // Local grid covers the overlay shell: [-1, w] x [-1, h] x [-1, d].
  const gw = w + 2
  const gh = h + 2
  const gd = d + 2
  const local = new Int32Array(gw * gh * gd).fill(-1)
  const ranks = new Uint8Array(gw * gh * gd)
  const localIndex = (i, j, k) => ((j + 1) * gd + (k + 1)) * gw + (i + 1)
  const colorCache = new Map()

  const facePixel = (uvSet, face, i, j, k) => {
    const rect = uvSet[face]
    const [px, py] = projectToFace(face, i, j, k, w, h, d)
    return sampler(rect.x + px, rect.y + py)
  }

  const visible = (pixel) => (pixel && pixel.a >= options.alphaCutoff ? pixel : null)

  const addRecord = (face, color, rank, i, j, k) => {
    const finalColor = adjustTone(color, options.tone)
    const key = `${face}:${finalColor.r},${finalColor.g},${finalColor.b},${finalColor.a}`
    let recordId = colorCache.get(key)
    if (recordId === undefined) {
      recordId = records.length
      records.push({
        part: name,
        face,
        blockFace: faceToBlockFace[face],
        color: finalColor,
        sourceColor: [finalColor.r, finalColor.g, finalColor.b, finalColor.a],
      })
      colorCache.set(key, recordId)
    }
    const index = localIndex(i, j, k)
    local[index] = recordId
    ranks[index] = rank
  }

  let filled = 0
  for (let j = 0; j < h; j += 1) {
    for (let k = 0; k < d; k += 1) {
      for (let i = 0; i < w; i += 1) {
        const depths = {
          front: k,
          back: d - 1 - k,
          right: i,
          left: w - 1 - i,
          top: h - 1 - j,
          bottom: j,
        }
        let minDepth = Infinity
        for (const face of FACES) minDepth = Math.min(minDepth, depths[face])
        const candidates = FACES.filter((face) => depths[face] === minDepth).sort(
          (a, b) => FACE_PRIORITY[b] - FACE_PRIORITY[a],
        )

        for (const face of candidates) {
          const base = options.includeBase ? visible(facePixel(baseUv, face, i, j, k)) : null
          const overlay =
            options.includeOverlay && options.overlayMode !== 'shell' && overlayUv
              ? visible(facePixel(overlayUv, face, i, j, k))
              : null
          const color = overlay ? compositeRgba(overlay, base) : base
          if (color) {
            addRecord(face, color, RANK_BASE, i, j, k)
            filled += 1
            break
          }
        }
      }
    }
  }

  if (hasOverlay && overlayUv) {
    for (let j = -1; j <= h; j += 1) {
      for (let k = -1; k <= d; k += 1) {
        for (let i = -1; i <= w; i += 1) {
          const faces = []
          if (i === -1) faces.push('right')
          if (i === w) faces.push('left')
          if (j === -1) faces.push('bottom')
          if (j === h) faces.push('top')
          if (k === -1) faces.push('front')
          if (k === d) faces.push('back')
          if (faces.length === 0) continue
          if (faces.length > 1 && !options.sealSeams) continue

          const ci = clamp(i, 0, w - 1)
          const cj = clamp(j, 0, h - 1)
          const ck = clamp(k, 0, d - 1)
          const hits = []
          for (const face of faces) {
            const overlay = visible(facePixel(overlayUv, face, ci, cj, ck))
            if (!overlay) continue
            const base = options.includeBase
              ? visible(facePixel(baseUv, face, ci, cj, ck))
              : null
            hits.push({ face, color: base ? compositeRgba(overlay, base) : overlay })
          }
          if (hits.length === 0) continue
          if (faces.length > 1 && hits.length < 2) continue
          hits.sort((a, b) => FACE_PRIORITY[b.face] - FACE_PRIORITY[a.face])
          addRecord(
            hits[0].face,
            hits[0].color,
            faces.length > 1 ? RANK_SEAM : RANK_OVERLAY,
            i,
            j,
            k,
          )
          filled += 1
        }
      }
    }
  }

  return {
    name,
    order,
    box,
    matrix,
    inverse: transpose(matrix),
    pivot: spec.pivot,
    local,
    ranks,
    gw,
    gh,
    gd,
    filled,
  }
}

// Maps a local voxel on a face to the pixel offset inside that face's UV rect,
// following the vanilla ModelPart cube UV layout.
function projectToFace(face, i, j, k, w, h, d) {
  switch (face) {
    case 'front':
      return [i, h - 1 - j]
    case 'back':
      return [w - 1 - i, h - 1 - j]
    case 'right':
      return [d - 1 - k, h - 1 - j]
    case 'left':
      return [k, h - 1 - j]
    case 'top':
      return [i, d - 1 - k]
    case 'bottom':
      return [i, d - 1 - k]
    default:
      return [0, 0]
  }
}

const BLOCK_FACE_BY_AXIS = [
  ['west', 'east'],
  ['down', 'up'],
  ['north', 'south'],
]

function blockFacesFor(matrix) {
  const result = {}
  for (const face of FACES) {
    const normal = applyMatrix(matrix, FACE_NORMALS[face])
    let axis = 0
    for (let index = 1; index < 3; index += 1) {
      if (Math.abs(normal[index]) > Math.abs(normal[axis])) axis = index
    }
    result[face] = BLOCK_FACE_BY_AXIS[axis][normal[axis] > 0 ? 1 : 0]
  }
  return result
}

// Rasterizes every posed part into one dense grid at the target scale by
// sampling each target cell center back into the part's local voxel grid.
function rasterize(parts, scale) {
  const active = parts.filter((part) => part.filled > 0)
  if (active.length === 0) return null

  const bounds = active.map((part) => partBounds(part, scale))
  const minX = Math.min(...bounds.map((b) => b[0]))
  const minY = Math.min(...bounds.map((b) => b[1]))
  const minZ = Math.min(...bounds.map((b) => b[2]))
  const maxX = Math.max(...bounds.map((b) => b[3]))
  const maxY = Math.max(...bounds.map((b) => b[4]))
  const maxZ = Math.max(...bounds.map((b) => b[5]))
  const W = maxX - minX + 1
  const H = maxY - minY + 1
  const L = maxZ - minZ + 1
  const cells = new Int32Array(W * H * L).fill(-1)
  const rank = new Uint8Array(W * H * L)

  active.forEach((part, index) => {
    const [bx0, by0, bz0, bx1, by1, bz1] = bounds[index]
    const { box, inverse, pivot, local, ranks, gw, gd, gh } = part
    const [px, py, pz] = pivot
    const identity = isIdentity(part.matrix)

    for (let Y = by0; Y <= by1; Y += 1) {
      for (let Z = bz0; Z <= bz1; Z += 1) {
        for (let X = bx0; X <= bx1; X += 1) {
          const cx = (X + 0.5) / scale
          const cy = (Y + 0.5) / scale
          const cz = (Z + 0.5) / scale
          let lx
          let ly
          let lz
          if (identity) {
            lx = cx - box.x
            ly = cy - box.y
            lz = cz - box.z
          } else {
            const dx = cx - px
            const dy = cy - py
            const dz = cz - pz
            lx = inverse[0] * dx + inverse[1] * dy + inverse[2] * dz + px - box.x
            ly = inverse[3] * dx + inverse[4] * dy + inverse[5] * dz + py - box.y
            lz = inverse[6] * dx + inverse[7] * dy + inverse[8] * dz + pz - box.z
          }
          const i = Math.floor(lx + 1e-9) + 1
          const j = Math.floor(ly + 1e-9) + 1
          const k = Math.floor(lz + 1e-9) + 1
          if (i < 0 || j < 0 || k < 0 || i >= gw || j >= gh || k >= gd) continue
          const li = (j * gd + k) * gw + i
          const recordId = local[li]
          if (recordId < 0) continue

          const cellRank = ranks[li] * 16 + part.order
          const target = ((Y - minY) * L + (Z - minZ)) * W + (X - minX)
          if (cellRank >= rank[target]) {
            rank[target] = cellRank
            cells[target] = recordId
          }
        }
      }
    }
  })

  return {
    cells,
    width: W,
    height: H,
    length: L,
  }
}

function partBounds(part, scale) {
  const { box, matrix, pivot } = part
  const xs = [box.x - 1, box.x + box.w + 1]
  const ys = [box.y - 1, box.y + box.h + 1]
  const zs = [box.z - 1, box.z + box.d + 1]
  let bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        const [rx, ry, rz] = applyMatrix(matrix, [x - pivot[0], y - pivot[1], z - pivot[2]])
        const point = [rx + pivot[0], ry + pivot[1], rz + pivot[2]]
        for (let axis = 0; axis < 3; axis += 1) {
          bounds[axis] = Math.min(bounds[axis], point[axis])
          bounds[axis + 3] = Math.max(bounds[axis + 3], point[axis])
        }
      }
    }
  }
  return [
    Math.floor(bounds[0] * scale) - 1,
    Math.floor(bounds[1] * scale) - 1,
    Math.floor(bounds[2] * scale) - 1,
    Math.ceil(bounds[3] * scale),
    Math.ceil(bounds[4] * scale),
    Math.ceil(bounds[5] * scale),
  ]
}

// Distance (in blocks) from each solid cell to the outside air, measured
// through solid cells. Cells touching outside air have depth 1; the search
// stops past maxDepth and leaves deeper cells at 65535.
function surfaceDepth(grid, maxDepth) {
  const { cells, width: W, height: H, length: L } = grid
  const size = W * H * L
  const layer = W * L
  const outside = new Uint8Array(size)
  const qx = new Int16Array(size)
  const qy = new Int16Array(size)
  const qz = new Int16Array(size)
  let head = 0
  let tail = 0

  const pushAir = (x, y, z, index) => {
    if (outside[index] || cells[index] >= 0) return
    outside[index] = 1
    qx[tail] = x
    qy[tail] = y
    qz[tail] = z
    tail += 1
  }

  for (let y = 0; y < H; y += 1) {
    for (let z = 0; z < L; z += 1) {
      for (let x = 0; x < W; x += 1) {
        if (x === 0 || y === 0 || z === 0 || x === W - 1 || y === H - 1 || z === L - 1) {
          pushAir(x, y, z, (y * L + z) * W + x)
        }
      }
    }
  }

  while (head < tail) {
    const x = qx[head]
    const y = qy[head]
    const z = qz[head]
    head += 1
    const index = (y * L + z) * W + x
    if (x > 0) pushAir(x - 1, y, z, index - 1)
    if (x < W - 1) pushAir(x + 1, y, z, index + 1)
    if (z > 0) pushAir(x, y, z - 1, index - W)
    if (z < L - 1) pushAir(x, y, z + 1, index + W)
    if (y > 0) pushAir(x, y - 1, z, index - layer)
    if (y < H - 1) pushAir(x, y + 1, z, index + layer)
  }

  const depth = new Uint16Array(size).fill(65535)
  head = 0
  tail = 0
  for (let y = 0; y < H; y += 1) {
    for (let z = 0; z < L; z += 1) {
      for (let x = 0; x < W; x += 1) {
        const index = (y * L + z) * W + x
        if (cells[index] < 0) continue
        const exposed =
          x === 0 ||
          y === 0 ||
          z === 0 ||
          x === W - 1 ||
          y === H - 1 ||
          z === L - 1 ||
          outside[index - 1] ||
          outside[index + 1] ||
          outside[index - W] ||
          outside[index + W] ||
          outside[index - layer] ||
          outside[index + layer]
        if (exposed) {
          depth[index] = 1
          qx[tail] = x
          qy[tail] = y
          qz[tail] = z
          tail += 1
        }
      }
    }
  }

  const pushSolid = (x, y, z, index, nextDepth) => {
    if (cells[index] < 0 || depth[index] <= nextDepth) return
    depth[index] = nextDepth
    qx[tail] = x
    qy[tail] = y
    qz[tail] = z
    tail += 1
  }

  while (head < tail) {
    const x = qx[head]
    const y = qy[head]
    const z = qz[head]
    head += 1
    const index = (y * L + z) * W + x
    const nextDepth = depth[index] + 1
    if (nextDepth > maxDepth) continue
    if (x > 0) pushSolid(x - 1, y, z, index - 1, nextDepth)
    if (x < W - 1) pushSolid(x + 1, y, z, index + 1, nextDepth)
    if (z > 0) pushSolid(x, y, z - 1, index - W, nextDepth)
    if (z < L - 1) pushSolid(x, y, z + 1, index + W, nextDepth)
    if (y > 0) pushSolid(x, y - 1, z, index - layer, nextDepth)
    if (y < H - 1) pushSolid(x, y + 1, z, index + layer, nextDepth)
  }

  return depth
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function clampInt(value, min, max) {
  const number = Math.round(Number(value))
  if (!Number.isFinite(number)) return min
  return clamp(number, min, max)
}
