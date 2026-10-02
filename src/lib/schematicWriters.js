import { gzip } from 'pako'
import {
  byteArray,
  compound,
  int,
  intArray,
  list,
  long,
  longArrayFromWords,
  nbtTag,
  short,
  string,
  writeNbt,
} from './nbt.js'
import {
  SURVIVAL_MIXED_DATA_VERSION,
  SURVIVAL_MIXED_VERSION,
} from '../generated/survivalMixedPalette.js'

const MAX_SCHEMATIC_DIMENSION = 32767
const BLOCK_STATE_PATTERN = /^[a-z0-9_.-]+:[a-z0-9_./-]+(?:\[[a-z0-9_]+=[a-z0-9_.-]+(?:,[a-z0-9_]+=[a-z0-9_.-]+)*\])?$/
const LITEMATIC_VERSION = 6
const LITEMATIC_SUB_VERSION = 1
const MAX_COMMAND_CHAIN = 65536

export const EXPORT_FORMATS = [
  {
    id: 'schem',
    label: 'Sponge schematic',
    extension: '.schem',
    tools: 'WorldEdit · FAWE · Axiom · Amulet',
    description: 'Paste the whole statue at once with //schem load and //paste.',
  },
  {
    id: 'litematic',
    label: 'Litematica',
    extension: '.litematic',
    tools: 'Litematica mod',
    description: 'Hologram build guide with a live material list. Best for survival.',
  },
  {
    id: 'mcfunction',
    label: 'Vanilla commands',
    extension: '.mcfunction',
    tools: 'Any datapack · no mods',
    description: 'Fill commands you run from a datapack function on any server.',
  },
]

export function createDownload(model, format, fileStem, meta = {}) {
  if (format === 'schematic') {
    throw new Error(
      'Legacy .schematic cannot preserve modern block states. Export .schem instead.',
    )
  }

  if (format === 'schem') {
    return {
      blob: new Blob([writeSpongeSchematic(model, meta)], {
        type: 'application/octet-stream',
      }),
      filename: `${fileStem}-java-${SURVIVAL_MIXED_VERSION}.schem`,
    }
  }

  if (format === 'litematic') {
    return {
      blob: new Blob([writeLitematic(model, { name: fileStem, ...meta })], {
        type: 'application/octet-stream',
      }),
      filename: `${fileStem}.litematic`,
    }
  }

  if (format === 'mcfunction') {
    const functionName = toFunctionName(fileStem)
    return {
      blob: new Blob([writeMcfunction(model, { name: functionName, ...meta })], {
        type: 'text/plain',
      }),
      filename: `${functionName}.mcfunction`,
    }
  }

  throw new Error(`Unsupported schematic format: ${format}`)
}

export function writeSpongeSchematic(model, meta = {}) {
  assertModel(model)

  const palette = buildPalette(model)
  const volume = model.width * model.height * model.length
  const indices = new Uint32Array(volume)
  for (const block of model.blocks) {
    indices[blockIndex(model, block.x, block.y, block.z)] = palette.get(block.state)
  }

  const blockData = new Uint8Array(volume * (palette.size > 127 ? 2 : 1))
  let cursor = 0
  for (let index = 0; index < volume; index += 1) {
    let value = indices[index]
    while (value >= 0x80) {
      blockData[cursor++] = (value & 0x7f) | 0x80
      value >>>= 7
    }
    blockData[cursor++] = value
  }

  const paletteTags = {}
  for (const [state, index] of palette.entries()) {
    paletteTags[state] = int(index)
  }

  const root = {
    Version: int(2),
    DataVersion: int(SURVIVAL_MIXED_DATA_VERSION),
    Width: short(model.width),
    Height: short(model.height),
    Length: short(model.length),
    Offset: intArray([0, 0, 0]),
    PaletteMax: int(palette.size),
    Palette: compound(paletteTags),
    BlockData: byteArray(blockData.subarray(0, cursor)),
    BlockEntities: list(nbtTag.compound, []),
    Entities: list(nbtTag.compound, []),
    Metadata: compound({
      Name: string(meta.title ?? 'Skinforge statue'),
      Author: string(meta.author ?? 'Skinforge'),
    }),
  }

  return gzip(writeNbt('Schematic', root))
}

// Litematica format: a gzip'd NBT compound with one region whose block states
// are bit-packed LSB-first across 64-bit longs, indexed y * X * Z + z * X + x.
export function writeLitematic(model, meta = {}) {
  assertModel(model)

  const palette = buildPalette(model)
  const { width: W, height: H, length: L } = model
  const volume = W * H * L
  const bits = Math.max(2, 32 - Math.clz32(palette.size - 1))
  const longCount = Math.ceil((volume * bits) / 64)
  const words = new Uint32Array(longCount * 2)

  for (const block of model.blocks) {
    const index = blockIndex(model, block.x, block.y, block.z)
    const value = palette.get(block.state)
    const bitPosition = index * bits
    const word = Math.floor(bitPosition / 32)
    const offset = bitPosition % 32
    words[word] = (words[word] | (value << offset)) >>> 0
    if (offset + bits > 32) {
      words[word + 1] = (words[word + 1] | (value >>> (32 - offset))) >>> 0
    }
  }

  const paletteEntries = [...palette.keys()].map((state) => {
    const { name, properties } = parseBlockState(state)
    const entry = { Name: string(name) }
    if (Object.keys(properties).length) {
      entry.Properties = compound(
        Object.fromEntries(
          Object.entries(properties).map(([key, value]) => [key, string(value)]),
        ),
      )
    }
    return compound(entry)
  })

  const now = meta.time ?? Date.now()
  const size = () => compound({ x: int(W), y: int(H), z: int(L) })
  const regionName = meta.name || 'Statue'
  const root = {
    MinecraftDataVersion: int(SURVIVAL_MIXED_DATA_VERSION),
    Version: int(LITEMATIC_VERSION),
    SubVersion: int(LITEMATIC_SUB_VERSION),
    Metadata: compound({
      Name: string(meta.title ?? regionName),
      Author: string(meta.author ?? 'Skinforge'),
      Description: string(meta.description ?? 'Skin statue made with Skinforge'),
      RegionCount: int(1),
      TotalVolume: int(volume),
      TotalBlocks: int(model.blocks.length),
      TimeCreated: long(now),
      TimeModified: long(now),
      EnclosingSize: size(),
    }),
    Regions: compound({
      [regionName]: compound({
        Position: compound({ x: int(0), y: int(0), z: int(0) }),
        Size: size(),
        BlockStatePalette: list(nbtTag.compound, paletteEntries),
        BlockStates: longArrayFromWords(words),
        TileEntities: list(nbtTag.compound, []),
        Entities: list(nbtTag.compound, []),
        PendingBlockTicks: list(nbtTag.compound, []),
        PendingFluidTicks: list(nbtTag.compound, []),
      }),
    }),
  }

  return gzip(writeNbt('', root))
}

// Vanilla function: runs of identical blocks along x become one fill command.
// The statue is built 3 blocks south of the runner, facing them.
export function writeMcfunction(model, meta = {}) {
  assertModel(model)

  const name = meta.name ?? 'statue'
  const xOffset = -Math.floor(model.width / 2)
  const zOffset = 3
  const commands = []
  const blocks = [...model.blocks].sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x)

  for (let index = 0; index < blocks.length; ) {
    const start = blocks[index]
    let end = index
    while (
      end + 1 < blocks.length &&
      blocks[end + 1].y === start.y &&
      blocks[end + 1].z === start.z &&
      blocks[end + 1].x === blocks[end].x + 1 &&
      blocks[end + 1].state === start.state
    ) {
      end += 1
    }
    const x1 = start.x + xOffset
    const x2 = blocks[end].x + xOffset
    const y = start.y
    const z = start.z + zOffset
    commands.push(
      x1 === x2
        ? `setblock ~${x1} ~${y} ~${z} ${start.state}`
        : `fill ~${x1} ~${y} ~${z} ~${x2} ~${y} ~${z} ${start.state}`,
    )
    index = end + 1
  }

  const header = [
    `# ${meta.title ?? 'Skinforge statue'}`,
    `# ${model.width} x ${model.height} x ${model.length} · ${model.blocks.length} blocks · ${commands.length} commands · Java ${SURVIVAL_MIXED_VERSION}`,
    '#',
    '# How to use:',
    `# 1. Put this file in <world>/datapacks/<pack>/data/<namespace>/function/${name}.mcfunction`,
    '# 2. Run /reload in game.',
    '# 3. Stand where you want to admire it from, face south, and run',
    `#    /function <namespace>:${name}`,
    '#    The statue builds 3 blocks in front of you, facing you.',
  ]
  if (commands.length > MAX_COMMAND_CHAIN) {
    header.push(
      '#',
      `# This build needs more than ${MAX_COMMAND_CHAIN} commands. First run:`,
      `#    /gamerule maxCommandChainLength ${commands.length + 100}`,
    )
  }

  return `${header.join('\n')}\n\n${commands.join('\n')}\n`
}

export function writeLegacySchematic(model) {
  assertModel(model)

  const volume = model.width * model.height * model.length
  const ids = new Uint8Array(volume)
  const data = new Uint8Array(volume)

  for (const block of model.blocks) {
    const index = blockIndex(model, block.x, block.y, block.z)
    ids[index] = block.legacyId
    data[index] = block.legacyData
  }

  const root = {
    Width: short(model.width),
    Height: short(model.height),
    Length: short(model.length),
    Materials: string('Alpha'),
    Blocks: byteArray(ids),
    Data: byteArray(data),
    Entities: list(nbtTag.compound, []),
    TileEntities: list(nbtTag.compound, []),
  }

  return gzip(writeNbt('Schematic', root))
}

export function parseBlockState(state) {
  const match = /^([^[]+)(?:\[(.*)\])?$/.exec(state)
  const properties = {}
  if (match?.[2]) {
    for (const pair of match[2].split(',')) {
      const [key, value] = pair.split('=')
      properties[key] = value
    }
  }
  return { name: match?.[1] ?? state, properties }
}

function toFunctionName(stem) {
  return (
    stem
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '_')
      .replace(/^[_.-]+|[_.-]+$/g, '') || 'statue'
  )
}

function buildPalette(model) {
  const palette = new Map([['minecraft:air', 0]])
  for (const block of model.blocks) {
    if (!palette.has(block.state)) palette.set(block.state, palette.size)
  }
  return palette
}

function blockIndex(model, x, y, z) {
  return y * model.length * model.width + z * model.width + x
}

function assertModel(model) {
  if (!model || !Array.isArray(model.blocks) || model.blocks.length === 0) {
    throw new Error('There are no blocks to export.')
  }

  for (const [name, value] of [
    ['width', model.width],
    ['height', model.height],
    ['length', model.length],
  ]) {
    if (!Number.isInteger(value) || value < 1 || value > MAX_SCHEMATIC_DIMENSION) {
      throw new Error(`Invalid schematic ${name}: ${value}`)
    }
  }

  const volume = model.width * model.height * model.length
  if (!Number.isSafeInteger(volume)) {
    throw new Error('Model dimensions are too large for schematic export.')
  }

  const seen = new Uint8Array(volume)
  for (const block of model.blocks) {
    if (
      !Number.isInteger(block.x) ||
      !Number.isInteger(block.y) ||
      !Number.isInteger(block.z) ||
      block.x < 0 ||
      block.y < 0 ||
      block.z < 0 ||
      block.x >= model.width ||
      block.y >= model.height ||
      block.z >= model.length
    ) {
      throw new Error(`Block is outside the schematic bounds at ${block.x}, ${block.y}, ${block.z}.`)
    }

    const index = blockIndex(model, block.x, block.y, block.z)
    if (seen[index]) {
      throw new Error(`Two blocks share the position ${block.x}, ${block.y}, ${block.z}.`)
    }
    seen[index] = 1

    if (typeof block.state !== 'string' || !BLOCK_STATE_PATTERN.test(block.state)) {
      throw new Error(`Invalid Minecraft block state: ${block.state ?? 'missing'}`)
    }

    if (!Number.isInteger(block.legacyId) || block.legacyId < 0 || block.legacyId > 255) {
      throw new Error(`Invalid legacy block id for ${block.state}.`)
    }

    if (
      !Number.isInteger(block.legacyData) ||
      block.legacyData < 0 ||
      block.legacyData > 15
    ) {
      throw new Error(`Invalid legacy block data for ${block.state}.`)
    }
  }
}
