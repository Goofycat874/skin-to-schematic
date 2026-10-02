import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import nbt from 'prismarine-nbt'
import { PNG } from 'pngjs'
import { SURVIVAL_MIXED_DATA_VERSION } from '../src/generated/survivalMixedPalette.js'
import { formatShulkers, formatStacks, materialsToCsv } from '../src/lib/materials.js'
import {
  createDownload,
  parseBlockState,
  writeLitematic,
  writeMcfunction,
  writeSpongeSchematic,
} from '../src/lib/schematicWriters.js'
import { buildSkinModel } from '../src/lib/skinModel.js'

const model = buildSkinModel(loadSample('moss-knight'), {
  palette: 'mixed',
  overlayMode: 'shell',
  pose: 'wave',
  scale: 2,
  pedestal: true,
})

test('sponge schematic decodes back to the same blocks', async () => {
  const parsed = nbt.simplify(
    (await nbt.parseUncompressed(gunzipSync(writeSpongeSchematic(model)))),
  )
  assert.equal(parsed.DataVersion, SURVIVAL_MIXED_DATA_VERSION)
  assert.deepEqual([parsed.Width, parsed.Height, parsed.Length], [model.width, model.height, model.length])

  const byIndex = Object.fromEntries(Object.entries(parsed.Palette).map(([state, id]) => [id, state]))
  const data = Uint8Array.from(parsed.BlockData, (value) => value & 0xff)
  const decoded = []
  for (let cursor = 0; cursor < data.length; ) {
    let value = 0
    let shift = 0
    let byte
    do {
      byte = data[cursor++]
      value |= (byte & 0x7f) << shift
      shift += 7
    } while (byte & 0x80)
    decoded.push(value)
  }
  assert.equal(decoded.length, model.width * model.height * model.length)
  for (const block of model.blocks) {
    const index = (block.y * model.length + block.z) * model.width + block.x
    assert.equal(byIndex[decoded[index]], block.state)
  }
  assert.equal(decoded.filter((value) => value !== 0).length, model.blocks.length)
})

test('litematic round-trips through its bit-packed long array', async () => {
  const buffer = writeLitematic(model, { name: 'Moss Knight', time: 1700000000000 })
  const root = nbt.simplify(await nbt.parseUncompressed(gunzipSync(buffer)))

  assert.equal(root.Version, 6)
  assert.equal(root.MinecraftDataVersion, SURVIVAL_MIXED_DATA_VERSION)
  assert.equal(root.Metadata.RegionCount, 1)
  assert.equal(root.Metadata.TotalBlocks, model.blocks.length)
  assert.deepEqual(root.Metadata.EnclosingSize, { x: model.width, y: model.height, z: model.length })

  const region = root.Regions['Moss Knight']
  assert.deepEqual(region.Size, { x: model.width, y: model.height, z: model.length })
  assert.deepEqual(region.Position, { x: 0, y: 0, z: 0 })
  const palette = region.BlockStatePalette
  assert.equal(palette[0].Name, 'minecraft:air')

  const bits = Math.max(2, 32 - Math.clz32(palette.length - 1))
  const longs = region.BlockStates.map(([high, low]) =>
    (BigInt.asUintN(32, BigInt(high)) << 32n) | BigInt.asUintN(32, BigInt(low)),
  )
  const volume = model.width * model.height * model.length
  assert.equal(longs.length, Math.ceil((volume * bits) / 64))

  const mask = (1n << BigInt(bits)) - 1n
  const getAt = (index) => {
    const start = BigInt(index * bits)
    const word = Number(start >> 6n)
    const offset = start & 63n
    let value = longs[word] >> offset
    if (offset + BigInt(bits) > 64n) value |= longs[word + 1] << (64n - offset)
    return Number(value & mask)
  }

  const stateOf = (entry) => {
    const props = entry.Properties
      ? `[${Object.entries(entry.Properties).map(([k, v]) => `${k}=${v}`).join(',')}]`
      : ''
    return `${entry.Name}${props}`
  }

  let nonAir = 0
  for (let index = 0; index < volume; index += 1) if (getAt(index) !== 0) nonAir += 1
  assert.equal(nonAir, model.blocks.length)
  for (const block of model.blocks) {
    const index = (block.y * model.length + block.z) * model.width + block.x
    assert.equal(stateOf(palette[getAt(index)]), block.state)
  }
})

test('mcfunction merges runs into fill commands that cover every block', () => {
  const text = writeMcfunction(model, { name: 'moss_knight' })
  const commands = text.split('\n').filter((line) => line && !line.startsWith('#'))
  assert.ok(commands.length < model.blocks.length, 'runs should be merged')

  let covered = 0
  for (const command of commands) {
    const fill = /^fill ~(-?\d+) ~(\d+) ~(\d+) ~(-?\d+) ~(\d+) ~(\d+) (\S+)$/.exec(command)
    const set = /^setblock ~(-?\d+) ~(\d+) ~(\d+) (\S+)$/.exec(command)
    assert.ok(fill || set, `bad command: ${command}`)
    covered += fill ? Number(fill[4]) - Number(fill[1]) + 1 : 1
  }
  assert.equal(covered, model.blocks.length)
  assert.match(text, /function <namespace>:moss_knight/)
})

test('downloads use the right extensions', () => {
  assert.match(createDownload(model, 'schem', 'knight').filename, /^knight-java-.+\.schem$/)
  assert.equal(createDownload(model, 'litematic', 'knight').filename, 'knight.litematic')
  assert.equal(createDownload(model, 'mcfunction', 'Moss Knight!').filename, 'moss_knight.mcfunction')
  assert.throws(() => createDownload(model, 'nope', 'x'), /Unsupported/)
})

test('block states parse into names and properties', () => {
  assert.deepEqual(parseBlockState('minecraft:oak_log[axis=y]'), {
    name: 'minecraft:oak_log',
    properties: { axis: 'y' },
  })
  assert.deepEqual(parseBlockState('minecraft:stone'), { name: 'minecraft:stone', properties: {} })
})

test('material math speaks survival', () => {
  assert.equal(formatStacks(40), '40')
  assert.equal(formatStacks(128), '2 st')
  assert.equal(formatStacks(150), '2 st + 22')
  assert.equal(formatShulkers(10), null)
  assert.equal(formatShulkers(1728 * 2), '2.0 shulkers')
  const csv = materialsToCsv([{ label: 'Oak, Log', state: 'minecraft:oak_log[axis=y]', count: 70 }])
  assert.match(csv, /"Oak, Log",minecraft:oak_log\[axis=y\],70,1,6,0\.04/)
})

function loadSample(id) {
  const png = PNG.sync.read(fs.readFileSync(new URL(`../public/samples/${id}.png`, import.meta.url)))
  return {
    name: `${id}.png`,
    width: png.width,
    height: png.height,
    imageData: { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) },
  }
}
