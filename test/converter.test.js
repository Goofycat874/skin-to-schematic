import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import nbt from 'prismarine-nbt'
import {
  SURVIVAL_MIXED_BLOCKS,
  SURVIVAL_MIXED_DATA_VERSION,
  SURVIVAL_MIXED_VERSION,
} from '../src/generated/survivalMixedPalette.js'
import { matchBlock } from '../src/lib/palettes.js'
import {
  createDownload,
  writeSpongeSchematic,
} from '../src/lib/schematicWriters.js'
import { buildSkinModel } from '../src/lib/skinModel.js'

const OPTIONS = {
  palette: 'mixed',
  scale: 1,
  thickness: 1,
  includeBase: true,
  includeOverlay: true,
  overlayMode: 'flatten',
  alphaCutoff: 24,
}

test('generated palette covers current survival full blocks with valid states', () => {
  assert.equal(SURVIVAL_MIXED_VERSION, '26.2')
  assert.equal(SURVIVAL_MIXED_DATA_VERSION, 4903)
  assert.ok(SURVIVAL_MIXED_BLOCKS.length >= 400)

  const byName = new Map(SURVIVAL_MIXED_BLOCKS.map((block) => [block.key, block]))
  for (const name of [
    'white_concrete',
    'oak_log',
    'brown_mushroom_block',
    'glass',
    'copper_grate',
    'white_concrete_powder',
  ]) {
    assert.ok(byName.has(name), `${name} should be indexed`)
  }
  assert.equal(byName.has('bedrock'), false)
  assert.notDeepEqual(byName.get('oak_log').faceRgb.north, byName.get('oak_log').faceRgb.up)

  const statePattern = /^[a-z0-9_.-]+:[a-z0-9_./-]+(?:\[[a-z0-9_]+=[a-z0-9_.-]+(?:,[a-z0-9_]+=[a-z0-9_.-]+)*\])?$/
  for (const block of SURVIVAL_MIXED_BLOCKS) {
    assert.match(block.state, statePattern)
    for (const direction of ['down', 'up', 'north', 'south', 'west', 'east']) {
      assert.equal(block.faceRgb[direction].length, 3)
    }
  }
})

test('matching uses the visible block face, not the six-face average', () => {
  const palette = {
    textureAware: true,
    blocks: [
      {
        state: 'minecraft:oak_log[axis=y]',
        rgb: [120, 90, 50],
        faceRgb: { north: [10, 20, 30], up: [240, 220, 180] },
        faceSpread: { north: 0, up: 0 },
        faceAlpha: { north: 1, up: 1 },
      },
      {
        state: 'minecraft:white_concrete',
        rgb: [225, 225, 225],
      },
    ],
  }

  assert.equal(matchBlock({ r: 12, g: 20, b: 31 }, palette, 'north').block.state, 'minecraft:oak_log[axis=y]')
  assert.equal(matchBlock({ r: 235, g: 224, b: 190 }, palette, 'up').block.state, 'minecraft:oak_log[axis=y]')
})

test('flattened overlays composite with the corresponding base UV pixel', () => {
  const skin = blankSkin()
  setPixel(skin.imageData, 8, 8, [0, 0, 255, 255])
  setPixel(skin.imageData, 40, 8, [255, 0, 0, 128])

  const model = buildSkinModel(skin, OPTIONS)
  assert.equal(model.blocks.length, 1)
  assert.deepEqual(model.blocks[0].sourceColor, [128, 0, 127, 255])
})

test('front pixels deterministically own shared front-side corner voxels', () => {
  const skin = blankSkin()
  setPixel(skin.imageData, 8, 8, [255, 0, 0, 255])
  setPixel(skin.imageData, 7, 8, [0, 0, 255, 255])

  const model = buildSkinModel(skin, { ...OPTIONS, includeOverlay: false })
  assert.equal(model.blocks.length, 1)
  assert.deepEqual(model.blocks[0].sourceColor, [255, 0, 0, 255])
  assert.equal(model.blocks[0].face, 'front')
})

test('modern schematic round-trips with current DataVersion and palette', async () => {
  const skin = blankSkin()
  setPixel(skin.imageData, 8, 8, [230, 80, 40, 255])
  const model = buildSkinModel(skin, { ...OPTIONS, includeOverlay: false })
  const uncompressed = gunzipSync(writeSpongeSchematic(model))
  const parsed = await nbt.parseUncompressed(uncompressed)
  const schematic = nbt.simplify(parsed)

  assert.equal(schematic.Version, 2)
  assert.equal(schematic.DataVersion, 4903)
  assert.equal(schematic.Width, 1)
  assert.equal(schematic.Height, 1)
  assert.equal(schematic.Length, 1)
  assert.equal(schematic.Palette['minecraft:air'], 0)
  assert.equal(Object.keys(schematic.Palette).length, 2)
  assert.equal(schematic.BlockData.length, 1)
  assert.equal(schematic.BlockData[0], 1)
})

test('legacy downloads are rejected before modern blocks can be remapped to wool', () => {
  assert.throws(
    () => createDownload({ blocks: [] }, 'schematic', 'test'),
    /cannot preserve modern block states/,
  )
})

function blankSkin() {
  return {
    name: 'test.png',
    width: 64,
    height: 64,
    imageData: {
      width: 64,
      height: 64,
      data: new Uint8ClampedArray(64 * 64 * 4),
    },
  }
}

function setPixel(imageData, x, y, rgba) {
  const index = (y * imageData.width + x) * 4
  imageData.data.set(rgba, index)
}
