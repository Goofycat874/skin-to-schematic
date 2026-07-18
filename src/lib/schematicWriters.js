import { gzip } from 'pako'
import {
  byteArray,
  compound,
  int,
  intArray,
  list,
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

export function createDownload(model, format, fileStem) {
  if (format === 'schematic') {
    throw new Error(
      'Legacy .schematic cannot preserve modern block states. Export .schem instead.',
    )
  }

  if (format !== 'schem') {
    throw new Error(`Unsupported schematic format: ${format}`)
  }

  return {
    blob: new Blob([writeSpongeSchematic(model)], {
      type: 'application/octet-stream',
    }),
    filename: `${fileStem}-java-${SURVIVAL_MIXED_VERSION}.schem`,
  }
}

export function writeSpongeSchematic(model) {
  assertModel(model)

  const palette = new Map([['minecraft:air', 0]])
  for (const block of model.blocks) {
    if (!palette.has(block.state)) palette.set(block.state, palette.size)
  }

  const blockData = encodeBlockData(model, (block) =>
    block ? palette.get(block.state) : 0,
  )

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
    BlockData: byteArray(blockData),
    BlockEntities: list(nbtTag.compound, []),
    Entities: list(nbtTag.compound, []),
    Metadata: compound({
      Name: string('Skin Schematic Forge export'),
      Author: string('Skin Schematic Forge'),
    }),
  }

  return gzip(writeNbt('Schematic', root))
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

function encodeBlockData(model, resolveIndex) {
  const byIndex = new Map()
  for (const block of model.blocks) {
    byIndex.set(blockIndex(model, block.x, block.y, block.z), block)
  }

  const encoded = []
  const volume = model.width * model.height * model.length

  for (let index = 0; index < volume; index += 1) {
    encoded.push(...encodeVarInt(resolveIndex(byIndex.get(index))))
  }

  return Uint8Array.from(encoded)
}

function encodeVarInt(value) {
  const bytes = []
  let current = value >>> 0

  do {
    let temp = current & 0x7f
    current >>>= 7
    if (current !== 0) temp |= 0x80
    bytes.push(temp)
  } while (current !== 0)

  return bytes
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

  const volume = model.width * model.height * model.length
  if (!Number.isSafeInteger(volume)) {
    throw new Error('Model dimensions are too large for schematic export.')
  }
}
