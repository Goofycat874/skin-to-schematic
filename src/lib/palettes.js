import {
  SURVIVAL_MIXED_BLOCKS,
  SURVIVAL_MIXED_VERSION,
} from '../generated/survivalMixedPalette.js'
import { oklabDistance, rgbToOklab } from './color.js'

const WOOL_LEGACY = {
  white: 0,
  orange: 1,
  magenta: 2,
  light_blue: 3,
  yellow: 4,
  lime: 5,
  pink: 6,
  gray: 7,
  light_gray: 8,
  cyan: 9,
  purple: 10,
  blue: 11,
  brown: 12,
  green: 13,
  red: 14,
  black: 15,
}

const WOOL_COLORS = [
  ['white', [234, 236, 237]],
  ['orange', [241, 118, 20]],
  ['magenta', [189, 68, 179]],
  ['light_blue', [58, 175, 217]],
  ['yellow', [248, 198, 39]],
  ['lime', [112, 185, 25]],
  ['pink', [237, 141, 172]],
  ['gray', [62, 68, 71]],
  ['light_gray', [142, 142, 134]],
  ['cyan', [21, 137, 145]],
  ['purple', [121, 42, 172]],
  ['blue', [53, 57, 157]],
  ['brown', [114, 71, 40]],
  ['green', [84, 109, 27]],
  ['red', [161, 39, 34]],
  ['black', [20, 21, 25]],
]

const CONCRETE_COLORS = [
  ['white', [207, 213, 214]],
  ['orange', [224, 97, 0]],
  ['magenta', [169, 48, 159]],
  ['light_blue', [36, 137, 199]],
  ['yellow', [241, 175, 21]],
  ['lime', [94, 168, 24]],
  ['pink', [214, 101, 143]],
  ['gray', [55, 58, 62]],
  ['light_gray', [125, 125, 115]],
  ['cyan', [21, 119, 136]],
  ['purple', [100, 31, 156]],
  ['blue', [44, 46, 143]],
  ['brown', [96, 59, 31]],
  ['green', [73, 91, 36]],
  ['red', [142, 32, 32]],
  ['black', [8, 10, 15]],
]

const TERRACOTTA_COLORS = [
  ['white', [210, 178, 161]],
  ['orange', [161, 83, 37]],
  ['magenta', [149, 88, 108]],
  ['light_blue', [113, 108, 137]],
  ['yellow', [186, 133, 35]],
  ['lime', [103, 117, 53]],
  ['pink', [161, 78, 78]],
  ['gray', [57, 42, 35]],
  ['light_gray', [135, 107, 98]],
  ['cyan', [86, 91, 91]],
  ['purple', [118, 70, 86]],
  ['blue', [74, 59, 91]],
  ['brown', [77, 51, 35]],
  ['green', [76, 83, 42]],
  ['red', [143, 61, 46]],
  ['black', [37, 22, 16]],
]

const CONCRETE_POWDER_COLORS = [
  ['white', [225, 227, 227]],
  ['orange', [227, 131, 31]],
  ['magenta', [192, 83, 185]],
  ['light_blue', [74, 180, 213]],
  ['yellow', [232, 199, 54]],
  ['lime', [125, 189, 42]],
  ['pink', [228, 153, 181]],
  ['gray', [76, 81, 84]],
  ['light_gray', [155, 155, 148]],
  ['cyan', [36, 148, 157]],
  ['purple', [131, 55, 177]],
  ['blue', [70, 73, 166]],
  ['brown', [126, 85, 54]],
  ['green', [97, 119, 44]],
  ['red', [168, 54, 50]],
  ['black', [25, 27, 32]],
]

const NATURAL_BLOCKS = [
  ['snow', 'minecraft:snow_block', [249, 254, 254], 'white'],
  ['quartz', 'minecraft:quartz_block', [235, 229, 222], 'white'],
  ['smooth_quartz', 'minecraft:smooth_quartz', [230, 224, 215], 'white'],
  ['calcite', 'minecraft:calcite', [224, 226, 221], 'white'],
  ['bone', 'minecraft:bone_block[axis=y]', [229, 225, 207], 'white'],
  [
    'mushroom_stem',
    'minecraft:mushroom_stem[down=true,east=true,north=true,south=true,up=true,west=true]',
    [203, 196, 184],
    'light_gray',
  ],
  ['smooth_sandstone', 'minecraft:smooth_sandstone', [220, 211, 160], 'yellow'],
  ['cut_sandstone', 'minecraft:cut_sandstone', [217, 196, 140], 'yellow'],
  ['sandstone', 'minecraft:sandstone', [216, 203, 155], 'yellow'],
  ['birch_planks', 'minecraft:birch_planks', [193, 175, 121], 'yellow'],
  ['stripped_birch', 'minecraft:stripped_birch_wood[axis=y]', [196, 176, 118], 'yellow'],
  ['oak_planks', 'minecraft:oak_planks', [162, 130, 78], 'brown'],
  ['stripped_oak', 'minecraft:stripped_oak_wood[axis=y]', [166, 132, 78], 'brown'],
  ['jungle_planks', 'minecraft:jungle_planks', [160, 115, 80], 'brown'],
  ['acacia_planks', 'minecraft:acacia_planks', [169, 91, 51], 'orange'],
  ['stripped_acacia', 'minecraft:stripped_acacia_wood[axis=y]', [174, 92, 59], 'orange'],
  ['copper', 'minecraft:copper_block', [192, 108, 79], 'orange'],
  ['cut_copper', 'minecraft:cut_copper', [191, 107, 80], 'orange'],
  ['raw_copper', 'minecraft:raw_copper_block', [154, 99, 70], 'brown'],
  ['honeycomb', 'minecraft:honeycomb_block', [229, 148, 29], 'orange'],
  ['pumpkin', 'minecraft:pumpkin', [197, 118, 24], 'orange'],
  ['terracotta', 'minecraft:terracotta', [152, 94, 67], 'brown'],
  ['packed_mud', 'minecraft:packed_mud', [143, 106, 79], 'brown'],
  [
    'brown_mushroom',
    'minecraft:brown_mushroom_block[down=true,east=true,north=true,south=true,up=true,west=true]',
    [149, 111, 81],
    'brown',
  ],
  ['granite', 'minecraft:granite', [149, 103, 86], 'brown'],
  ['polished_granite', 'minecraft:polished_granite', [154, 106, 89], 'brown'],
  ['red_sandstone', 'minecraft:red_sandstone', [186, 99, 29], 'orange'],
  ['cut_red_sandstone', 'minecraft:cut_red_sandstone', [188, 93, 25], 'orange'],
  ['bricks', 'minecraft:bricks', [151, 97, 83], 'red'],
  ['mud_bricks', 'minecraft:mud_bricks', [137, 103, 79], 'brown'],
  ['dripstone', 'minecraft:dripstone_block', [134, 107, 91], 'brown'],
  ['rooted_dirt', 'minecraft:rooted_dirt', [144, 103, 75], 'brown'],
  ['coarse_dirt', 'minecraft:coarse_dirt', [119, 85, 59], 'brown'],
  ['dirt', 'minecraft:dirt', [134, 96, 67], 'brown'],
  ['mud', 'minecraft:mud', [60, 57, 61], 'gray'],
  ['tuff', 'minecraft:tuff', [108, 109, 102], 'gray'],
  ['andesite', 'minecraft:andesite', [136, 136, 136], 'light_gray'],
  ['polished_andesite', 'minecraft:polished_andesite', [133, 135, 134], 'light_gray'],
  ['stone', 'minecraft:stone', [126, 126, 126], 'gray'],
  ['smooth_stone', 'minecraft:smooth_stone', [158, 158, 158], 'light_gray'],
  ['cobblestone', 'minecraft:cobblestone', [128, 128, 128], 'gray'],
  ['deepslate', 'minecraft:deepslate[axis=y]', [74, 74, 79], 'gray'],
  ['polished_deepslate', 'minecraft:polished_deepslate', [72, 72, 74], 'gray'],
  ['blackstone', 'minecraft:blackstone', [42, 35, 40], 'black'],
  ['coal', 'minecraft:coal_block', [17, 16, 15], 'black'],
  ['moss', 'minecraft:moss_block', [89, 109, 45], 'green'],
  ['mossy_cobblestone', 'minecraft:mossy_cobblestone', [109, 121, 85], 'green'],
  ['melon', 'minecraft:melon', [147, 146, 38], 'lime'],
  ['hay', 'minecraft:hay_block[axis=y]', [166, 136, 38], 'yellow'],
  ['ochre_froglight', 'minecraft:ochre_froglight[axis=y]', [244, 221, 160], 'yellow'],
  [
    'red_mushroom',
    'minecraft:red_mushroom_block[down=true,east=true,north=true,south=true,up=true,west=true]',
    [200, 46, 45],
    'red',
  ],
  ['mangrove_planks', 'minecraft:mangrove_planks', [117, 54, 48], 'red'],
]

const SKIN_TONE_BLOCKS = NATURAL_BLOCKS.filter(([key]) =>
  [
    'quartz',
    'smooth_quartz',
    'calcite',
    'bone',
    'mushroom_stem',
    'smooth_sandstone',
    'cut_sandstone',
    'sandstone',
    'birch_planks',
    'stripped_birch',
    'oak_planks',
    'stripped_oak',
    'jungle_planks',
    'acacia_planks',
    'stripped_acacia',
    'copper',
    'cut_copper',
    'raw_copper',
    'terracotta',
    'packed_mud',
    'brown_mushroom',
    'granite',
    'polished_granite',
    'bricks',
    'mud_bricks',
    'dripstone',
    'rooted_dirt',
    'coarse_dirt',
    'dirt',
    'blackstone',
    'coal',
  ].includes(key),
)

function toEntry(family, colorName, rgb) {
  return {
    key: `${family}:${colorName}`,
    label: `${title(colorName)} ${title(family)}`,
    state: `minecraft:${colorName}_${family}`,
    rgb,
    legacyId: 35,
    legacyData: WOOL_LEGACY[colorName],
  }
}

function customEntry(key, state, rgb, legacyColor) {
  return {
    key,
    label: title(key),
    state,
    rgb,
    legacyId: 35,
    legacyData: WOOL_LEGACY[legacyColor],
  }
}

function title(value) {
  return value
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

const palettes = {
  fidelity: {
    label: 'Skin Match',
    description: 'Uses natural blocks plus color blocks for less muddy imports.',
    blocks: [
      ...NATURAL_BLOCKS.map(([key, state, rgb, legacyColor]) =>
        customEntry(key, state, rgb, legacyColor),
      ),
      ...CONCRETE_COLORS.map(([name, rgb]) => toEntry('concrete', name, rgb)),
      ...WOOL_COLORS.map(([name, rgb]) => toEntry('wool', name, rgb)),
      ...TERRACOTTA_COLORS.map(([name, rgb]) =>
        toEntry('terracotta', name, rgb),
      ),
    ],
  },
  skin: {
    label: 'Skin Tones',
    description: 'Warm woods, stone, copper, mud, and quartz for faces/clothes.',
    blocks: [
      ...SKIN_TONE_BLOCKS.map(([key, state, rgb, legacyColor]) =>
        customEntry(key, state, rgb, legacyColor),
      ),
      ...TERRACOTTA_COLORS.map(([name, rgb]) =>
        toEntry('terracotta', name, rgb),
      ),
    ],
  },
  natural: {
    label: 'Natural Blocks',
    description: 'Wood, stone, copper, moss, dirt, quartz, and froglight blocks.',
    blocks: NATURAL_BLOCKS.map(([key, state, rgb, legacyColor]) =>
      customEntry(key, state, rgb, legacyColor),
    ),
  },
  concrete: {
    label: 'Concrete',
    description: 'Clean, saturated colors for high contrast skins.',
    blocks: CONCRETE_COLORS.map(([name, rgb]) => toEntry('concrete', name, rgb)),
  },
  powder: {
    label: 'Concrete Powder',
    description: 'Softer full-color option with less plastic-looking saturation.',
    blocks: CONCRETE_POWDER_COLORS.map(([name, rgb]) =>
      toEntry('concrete_powder', name, rgb),
    ),
  },
  wool: {
    label: 'Wool',
    description: 'Softer color matching with strong legacy schematic support.',
    blocks: WOOL_COLORS.map(([name, rgb]) => toEntry('wool', name, rgb)),
  },
  terracotta: {
    label: 'Terracotta',
    description: 'Muted, earthy colors that work well for skin tones.',
    blocks: TERRACOTTA_COLORS.map(([name, rgb]) =>
      toEntry('terracotta', name, rgb),
    ),
  },
  mixed: {
    label: 'Survival Max',
    description: `Face-aware matching across ${SURVIVAL_MIXED_BLOCKS.length} survival full blocks from Java ${SURVIVAL_MIXED_VERSION}.`,
    blocks: SURVIVAL_MIXED_BLOCKS,
    textureAware: true,
  },
}

export const paletteOptions = Object.entries(palettes).map(([id, value]) => ({
  id,
  label: value.label,
  description: value.description,
})).sort((a, b) => Number(b.id === 'mixed') - Number(a.id === 'mixed'))

export function getPalette(id) {
  return palettes[id] ?? palettes.fidelity
}

const blockLabCache = new WeakMap()

export function matchBlock(color, palette, face = 'north') {
  let bestBlock = palette.blocks[0]
  let bestRgb = bestBlock.faceRgb?.[face] ?? bestBlock.rgb
  let bestError = Number.POSITIVE_INFINITY
  let bestScore = Number.POSITIVE_INFINITY
  const targetLab = rgbToOklab([color.r, color.g, color.b])

  for (const block of palette.blocks) {
    const rgb = block.faceRgb?.[face] ?? block.rgb
    const error = oklabDistance(targetLab, getBlockLab(block, face, rgb))
    let score = error

    if (palette.textureAware) {
      const spread = block.faceSpread?.[face] ?? block.textureSpread ?? 0
      const alpha = block.faceAlpha?.[face] ?? 1
      score += spread * 0.025
      if (alpha < 0.98) score += 1.5 + (1 - alpha) * 6
      if (block.unstable) score += 1
    }

    if (score < bestScore) {
      bestScore = score
      bestError = error
      bestBlock = block
      bestRgb = rgb
    }
  }

  return {
    block: bestBlock,
    rgb: bestRgb,
    error: bestError,
    score: bestScore,
  }
}

export function nearestBlock(color, palette, face = 'north') {
  return matchBlock(color, palette, face).block
}

function getBlockLab(block, face, rgb) {
  let cached = blockLabCache.get(block)
  if (!cached) {
    cached = {}
    blockLabCache.set(block, cached)
  }
  if (!cached[face]) cached[face] = rgbToOklab(rgb)
  return cached[face]
}
