import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { PNG } from 'pngjs'
import { adjustTone } from '../src/lib/color.js'
import { blockCategories } from '../src/lib/palettes.js'
import { buildSkinModel, detectSkinModel } from '../src/lib/skinModel.js'

const OPTIONS = {
  palette: 'mixed',
  scale: 1,
  thickness: 1,
  includeBase: true,
  includeOverlay: true,
  overlayMode: 'flatten',
  alphaCutoff: 24,
}

test('top face texture rows run back-to-front like the vanilla model', () => {
  const skin = blankSkin()
  // Head top rect starts at (8, 0); its bottom row borders the face.
  setPixel(skin.imageData, 8 + 3, 7, [255, 0, 0, 255])
  // Back face top row, mirrored x: px 4 sits above i = 3.
  setPixel(skin.imageData, 24 + 4, 8, [0, 0, 255, 255])

  const model = buildSkinModel(skin, OPTIONS)
  assert.equal(model.blocks.length, 2)
  const top = model.blocks.find((block) => block.face === 'top')
  const back = model.blocks.find((block) => block.face === 'back')
  assert.equal(top.z, 0, 'front edge of the top texture lands on the front')
  assert.equal(back.z, 7)
  assert.equal(top.x, back.x)
})

test('thicker shells keep side colors on the sides instead of smearing the front', () => {
  const skin = blankSkin()
  fillRect(skin.imageData, 0, 0, 64, 64, [200, 200, 200, 255])
  fillRect(skin.imageData, 8, 8, 8, 8, [220, 30, 30, 255]) // head front
  fillRect(skin.imageData, 0, 8, 8, 8, [30, 30, 220, 255]) // head right side

  const model = buildSkinModel(skin, { ...OPTIONS, includeOverlay: false, thickness: 3 })
  const rightSide = model.blocks.filter(
    (block) => block.part === 'head' && block.face === 'right',
  )
  assert.ok(rightSide.length > 0)
  for (const block of rightSide) assert.deepEqual(block.sourceColor, [30, 30, 220, 255])
  // The character's right side faces east (+x) when the statue faces north.
  const rightHeadX = Math.max(...model.blocks.filter((b) => b.part === 'head').map((b) => b.x))
  const sideColumn = model.blocks.filter(
    (b) => b.part === 'head' && b.x === rightHeadX && b.z > 0 && b.z < 7,
  )
  assert.ok(sideColumn.every((block) => block.face === 'right'))
})

test('slim skins are detected and get 3px arms', () => {
  const neon = loadSample('neon')
  assert.equal(detectSkinModel(neon), 'slim')
  assert.equal(detectSkinModel(loadSample('pathfinder')), 'classic')

  const slim = buildSkinModel(neon, OPTIONS)
  const forcedClassic = buildSkinModel(neon, { ...OPTIONS, skinModel: 'classic' })
  assert.equal(slim.skinType, 'slim')
  assert.equal(slim.width, 14)
  assert.equal(forcedClassic.width, 16)
})

test('legacy 64x32 skins mirror the right limbs onto the left', () => {
  const skin = blankSkin(32)
  fillRect(skin.imageData, 0, 0, 64, 32, [180, 180, 180, 255])
  fillRect(skin.imageData, 32, 0, 32, 16, [0, 0, 0, 0]) // transparent hat
  setPixel(skin.imageData, 44, 20, [255, 0, 0, 255]) // right arm front, outer column

  const model = buildSkinModel(skin, { ...OPTIONS, includeOverlay: false })
  const red = model.blocks.filter((block) => block.sourceColor[0] === 255)
  assert.equal(red.length, 2)
  assert.deepEqual(red.map((block) => block.x).sort((a, b) => a - b), [0, model.width - 1])
})

test('legacy skins treat a fully opaque hat layer as transparent', () => {
  const skin = blankSkin(32)
  fillRect(skin.imageData, 0, 0, 64, 32, [180, 180, 180, 255])
  const model = buildSkinModel(skin, { ...OPTIONS, overlayMode: 'shell' })
  assert.equal(model.height, 32)
  assert.equal(model.width, 16)
})

test('poses move limbs: zombie arms reach forward', () => {
  const skin = loadSample('pathfinder')
  const standing = buildSkinModel(skin, OPTIONS)
  const zombie = buildSkinModel(skin, { ...OPTIONS, pose: 'zombie' })
  assert.equal(zombie.length, standing.length + 6, 'arms extend in front of the body')
  assert.equal(zombie.width, standing.width)

  const tpose = buildSkinModel(skin, { ...OPTIONS, pose: 'tpose' })
  assert.equal(tpose.width, standing.width + 14, 'arms stretch out sideways')

  const custom = buildSkinModel(skin, {
    ...OPTIONS,
    pose: 'custom',
    customPose: { rightArm: { pitch: 90 } },
  })
  assert.ok(custom.length > standing.length)
})

test('statues are not mirrored: the face reads left-to-right from the front', () => {
  const skin = blankSkin()
  setPixel(skin.imageData, 8, 8, [255, 0, 0, 255]) // face, left edge of the texture
  setPixel(skin.imageData, 15, 8, [0, 0, 255, 255]) // face, right edge of the texture
  const model = buildSkinModel(skin, OPTIONS)
  const red = model.blocks.find((block) => block.sourceColor[0] === 255)
  const blue = model.blocks.find((block) => block.sourceColor[2] === 255)
  // A viewer north of the statue looks south, so east (+x) is on their left,
  // exactly where the left edge of the face texture belongs.
  assert.ok(red.x > blue.x)
  assert.equal(red.blockFace, 'north')
})

test('side faces report their real compass direction', () => {
  const skin = blankSkin()
  setPixel(skin.imageData, 3, 10, [255, 0, 0, 255]) // head right side
  setPixel(skin.imageData, 19, 10, [0, 0, 255, 255]) // head left side
  const model = buildSkinModel(skin, OPTIONS)
  assert.equal(model.blocks.find((b) => b.face === 'right').blockFace, 'east')
  assert.equal(model.blocks.find((b) => b.face === 'left').blockFace, 'west')
})

test('rotated limbs face their texture toward the new direction', () => {
  const skin = loadSample('pathfinder')
  const zombie = buildSkinModel(skin, { ...OPTIONS, pose: 'zombie' })
  const armFront = zombie.blocks.filter(
    (block) => block.part === 'rightArm' && block.face === 'front',
  )
  assert.ok(armFront.length > 0)
  assert.ok(armFront.every((block) => block.blockFace === 'up'))
})

test('hollow statues keep only blocks that touch the outside air', () => {
  const skin = loadSample('pathfinder')
  for (const options of [OPTIONS, { ...OPTIONS, pose: 'dab', scale: 2 }]) {
    const model = buildSkinModel(skin, options)
    const occupied = new Set(model.blocks.map(({ x, y, z }) => `${x},${y},${z}`))
    for (const { x, y, z } of model.blocks) {
      const neighbors = [
        [x - 1, y, z],
        [x + 1, y, z],
        [x, y - 1, z],
        [x, y + 1, z],
        [x, y, z - 1],
        [x, y, z + 1],
      ]
      assert.ok(
        neighbors.some((n) => !occupied.has(n.join(','))),
        `block at ${x},${y},${z} is buried`,
      )
    }
    assert.ok(model.stats.hiddenRemoved > 0)
  }
})

test('filled interiors use the filler block and stay hidden', () => {
  const skin = loadSample('pathfinder')
  const model = buildSkinModel(skin, {
    ...OPTIONS,
    scale: 2,
    interior: 'filled',
    fillerBlock: 'minecraft:cobblestone',
  })
  const filler = model.blocks.filter((block) => block.kind === 'filler')
  assert.ok(filler.length > 0)
  assert.ok(filler.every((block) => block.state === 'minecraft:cobblestone'))
  assert.equal(model.blocks.length, model.stats.solidVolume)
  assert.equal(model.stats.fillerBlocks, filler.length)
})

test('scale multiplies the bounds and pedestals sit underneath', () => {
  const skin = loadSample('astro')
  const base = buildSkinModel(skin, OPTIONS)
  const scaled = buildSkinModel(skin, { ...OPTIONS, scale: 2 })
  assert.deepEqual(
    [scaled.width, scaled.height, scaled.length],
    [base.width * 2, base.height * 2, base.length * 2],
  )

  const pedestal = buildSkinModel(skin, { ...OPTIONS, pedestal: true })
  assert.equal(pedestal.height, base.height + 1)
  assert.equal(pedestal.width, base.width + 2)
  const floor = pedestal.blocks.filter((block) => block.y === 0)
  assert.equal(floor.length, pedestal.width * pedestal.length)
  assert.ok(floor.every((block) => block.kind === 'pedestal'))
})

test('blocks come out sorted by layer and never overlap', () => {
  const model = buildSkinModel(loadSample('moss-knight'), {
    ...OPTIONS,
    overlayMode: 'shell',
    pose: 'wave',
    pedestal: true,
  })
  const keys = new Set()
  for (let index = 0; index < model.blocks.length; index += 1) {
    const block = model.blocks[index]
    const key = `${block.x},${block.y},${block.z}`
    assert.equal(keys.has(key), false, `duplicate block at ${key}`)
    keys.add(key)
    if (index > 0) assert.ok(model.blocks[index - 1].y <= block.y)
  }
})

test('banned blocks and survival filters are respected', () => {
  const skin = loadSample('pathfinder')
  const model = buildSkinModel(skin, OPTIONS)
  const top = model.usedBlocks[0].state
  const banned = buildSkinModel(skin, { ...OPTIONS, excludedBlocks: [top] })
  assert.equal(banned.paletteStates.includes(top), false)

  const filtered = buildSkinModel(skin, {
    ...OPTIONS,
    filters: ['functional', 'gravity', 'transparent', 'rare'],
  })
  for (const block of filtered.usedBlocks) {
    assert.equal(blockCategories(block).size, 0, `${block.state} should be filtered`)
  }
})

test('tone adjustments brighten and desaturate in OKLab', () => {
  const color = { r: 120, g: 80, b: 60, a: 255 }
  const brighter = adjustTone(color, { brightness: 40, contrast: 0, saturation: 0 })
  assert.ok(brighter.r > color.r && brighter.g > color.g)
  const gray = adjustTone(color, { brightness: 0, contrast: 0, saturation: -100 })
  assert.ok(Math.abs(gray.r - gray.g) <= 2 && Math.abs(gray.g - gray.b) <= 2)
  assert.equal(adjustTone(color, { brightness: 0, contrast: 0, saturation: 0 }), color)
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

function blankSkin(height = 64) {
  return {
    name: 'test.png',
    width: 64,
    height,
    imageData: { width: 64, height, data: new Uint8ClampedArray(64 * height * 4) },
  }
}

function setPixel(imageData, x, y, rgba) {
  imageData.data.set(rgba, (y * imageData.width + x) * 4)
}

function fillRect(imageData, x0, y0, w, h, rgba) {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) setPixel(imageData, x, y, rgba)
  }
}
