// Paints the original sample skins shipped in public/samples.
// Run with: npm run generate:samples
import fs from 'node:fs/promises'
import { PNG } from 'pngjs'

const OUT_DIR = new URL('../public/samples/', import.meta.url)

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

function layout(armWidth) {
  return {
    head: cuboidUv(8, 8, 8, 0, 0),
    hat: cuboidUv(8, 8, 8, 32, 0),
    body: cuboidUv(8, 12, 4, 16, 16),
    jacket: cuboidUv(8, 12, 4, 16, 32),
    rightArm: cuboidUv(armWidth, 12, 4, 40, 16),
    rightSleeve: cuboidUv(armWidth, 12, 4, 40, 32),
    leftArm: cuboidUv(armWidth, 12, 4, 32, 48),
    leftSleeve: cuboidUv(armWidth, 12, 4, 48, 48),
    rightLeg: cuboidUv(4, 12, 4, 0, 16),
    rightPants: cuboidUv(4, 12, 4, 0, 32),
    leftLeg: cuboidUv(4, 12, 4, 16, 48),
    leftPants: cuboidUv(4, 12, 4, 0, 48),
  }
}

function hex(value, alpha = 255) {
  const n = Number.parseInt(value.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha]
}

function mix(a, b, t) {
  return a.map((value, index) => Math.round(value + (b[index] - value) * t))
}

function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function createSkin(armWidth, seed) {
  const png = new PNG({ width: 64, height: 64 })
  png.data.fill(0)
  const uv = layout(armWidth)

  function set(x, y, color, grain = 0.06) {
    if (!color) return
    const index = (y * 64 + x) * 4
    const shade = 1 + (hash(x, y, seed) - 0.5) * 2 * grain
    png.data[index] = Math.max(0, Math.min(255, Math.round(color[0] * shade)))
    png.data[index + 1] = Math.max(0, Math.min(255, Math.round(color[1] * shade)))
    png.data[index + 2] = Math.max(0, Math.min(255, Math.round(color[2] * shade)))
    png.data[index + 3] = color[3] ?? 255
  }

  // painter(face, px, py, w, h) returns an rgba array or null.
  function paint(part, painter, grain) {
    for (const [face, rect] of Object.entries(uv[part])) {
      for (let py = 0; py < rect.h; py += 1) {
        for (let px = 0; px < rect.w; px += 1) {
          set(rect.x + px, rect.y + py, painter(face, px, py, rect.w, rect.h), grain)
        }
      }
    }
  }

  return { png, paint, armWidth }
}

function face({ skin, hair, iris, brow, mouth, blush, lashes }) {
  return (f, px, py) => {
    if (f === 'top') return hair
    if (f === 'bottom') return mix(skin, [0, 0, 0, 255], 0.12)
    if (f === 'back') return py < 7 ? hair : skin
    if (f === 'right' || f === 'left') {
      if (py < 3) return hair
      if (py === 3 && (f === 'right' ? px > 3 : px < 4)) return hair
      if (py === 5 && (f === 'right' ? px === 3 : px === 4)) return mix(skin, [0, 0, 0, 255], 0.18)
      return skin
    }
    // front
    if (py < 2) return hair
    if (py === 2 && (px === 0 || px === 7 || px === 5 || px === 6)) return hair
    if (py === 3 && (px === 1 || px === 2 || px === 5 || px === 6)) return brow
    if (py === 4) {
      if (px === 1 || px === 6) return lashes ? lashes : [244, 244, 240, 255]
      if (px === 2 || px === 5) return iris
    }
    if (py === 5 && (px === 3 || px === 4)) return mix(skin, [0, 0, 0, 255], 0.14)
    if (py === 5 && blush && (px === 1 || px === 6)) return blush
    if (py === 6 && (px === 3 || px === 4)) return mouth
    return skin
  }
}

const samples = []

// 1. Pathfinder — a classic explorer.
{
  const skinTone = hex('#c98e66')
  const hair = hex('#3b2618')
  const shirt = hex('#2a9d8f')
  const shirtDark = hex('#1f7a6f')
  const pants = hex('#264653')
  const boots = hex('#6d4c2f')
  const leather = hex('#7a5230')
  const skin = createSkin(4, 11)
  skin.paint('head', face({ skin: skinTone, hair, iris: hex('#2f7f86'), brow: hex('#2a1a10'), mouth: hex('#8a4b3a') }))
  skin.paint('hat', (f, px, py) => {
    if (f === 'top' || f === 'bottom') return null
    return py === 2 ? hex('#e76f51') : null
  })
  skin.paint('body', (f, px, py) => {
    if (py === 9) return f === 'front' && (px === 3 || px === 4) ? hex('#e9c46a') : leather
    if (py > 9) return pants
    if (f === 'front' && py < 3 && (px === 3 || px === 4) && py >= 0) return py === 0 ? skinTone : shirtDark
    return shirt
  })
  skin.paint('jacket', (f, px, py) => {
    if (f === 'front' && py < 9 && (px === 1 || px === 6)) return leather
    if (f === 'back' && py >= 1 && py <= 8 && px >= 1 && px <= 6) {
      if (py === 1 || px === 1 || px === 6) return mix(leather, [0, 0, 0, 255], 0.2)
      return py === 4 ? hex('#e9c46a') : leather
    }
    if (f === 'top' && (px === 1 || px === 6)) return leather
    return null
  })
  const arm = (f, px, py) => {
    if (f === 'top') return shirt
    if (f === 'bottom') return mix(skinTone, [0, 0, 0, 255], 0.1)
    if (py < 4) return py === 3 ? shirtDark : shirt
    if (py === 8) return hex('#5b3a1e')
    return skinTone
  }
  skin.paint('rightArm', arm)
  skin.paint('leftArm', arm)
  const leg = (f, px, py) => {
    if (f === 'top') return pants
    if (f === 'bottom') return mix(boots, [0, 0, 0, 255], 0.4)
    if (py >= 11) return mix(boots, [0, 0, 0, 255], 0.35)
    if (py >= 8) return boots
    return pants
  }
  skin.paint('rightLeg', leg)
  skin.paint('leftLeg', leg)
  samples.push({ id: 'pathfinder', name: 'Pathfinder', model: 'classic', png: skin.png })
}

// 2. Neon — slim arms, pastel hair, headphones.
{
  const skinTone = hex('#f1c7a5')
  const hairA = hex('#ff5fa2')
  const hairB = hex('#9b5de5')
  const hoodie = hex('#b8a1ff')
  const hoodieDark = hex('#8f78e6')
  const lime = hex('#c6f432')
  const ink = hex('#1d1b2e')
  const skin = createSkin(3, 23)
  const hairAt = (py) => mix(hairA, hairB, Math.min(1, py / 7))
  skin.paint('head', (f, px, py) => {
    if (f === 'top') return hairA
    if (f === 'bottom') return mix(skinTone, ink, 0.1)
    if (f === 'back') return hairAt(py)
    if (f === 'right' || f === 'left') return py < 7 || (f === 'right' ? px > 2 : px < 5) ? hairAt(py) : skinTone
    if (py < 2) return hairAt(py)
    if (py === 2 && px !== 3 && px !== 4) return hairAt(py)
    if ((px === 0 || px === 7) && py < 7) return hairAt(py)
    if (py === 3 && (px === 2 || px === 5)) return ink
    if (py === 4 && (px === 2 || px === 5)) return hex('#6a4c93')
    if (py === 4 && (px === 1 || px === 6)) return [250, 250, 250, 255]
    if (py === 5 && (px === 1 || px === 6)) return hex('#ff9eb5')
    if (py === 6 && (px === 3 || px === 4)) return hex('#d6456f')
    return skinTone
  })
  skin.paint('hat', (f, px, py) => {
    if (f === 'top' && (px === 3 || px === 4)) return ink
    if ((f === 'right' || f === 'left') && py >= 3 && py <= 5 && px >= 2 && px <= 5) {
      return py === 4 && (px === 3 || px === 4) ? lime : ink
    }
    if ((f === 'right' || f === 'left') && py < 3 && (px === 3 || px === 4)) return ink
    return null
  })
  skin.paint('body', (f, px, py) => {
    if (py >= 10) return ink
    if (f === 'front') {
      const bolt = [[4, 2], [3, 3], [4, 3], [2, 4], [3, 4], [4, 4], [5, 4], [3, 5], [4, 5], [3, 6]]
      if (bolt.some(([bx, by]) => bx === px && by === py)) return lime
      if (py < 4 && (px === 2 || px === 5) && py > 0) return [250, 250, 250, 255]
      if (py === 9) return hoodieDark
    }
    return hoodie
  })
  skin.paint('jacket', (f, px, py) => {
    if (f === 'back' && py < 3) return hoodieDark
    return null
  })
  const arm = (f, px, py) => {
    if (f === 'bottom') return mix(skinTone, ink, 0.1)
    if (py >= 10) return skinTone
    if (py === 9) return hoodieDark
    return hoodie
  }
  skin.paint('rightArm', arm)
  skin.paint('leftArm', arm)
  const leg = (f, px, py) => {
    if (f === 'bottom') return [235, 235, 235, 255]
    if (py >= 10) return py === 11 ? lime : [245, 245, 245, 255]
    if (f === 'right' || f === 'left') return py === 5 || py === 6 ? hex('#3a3a5c') : ink
    return ink
  }
  skin.paint('rightLeg', leg)
  skin.paint('leftLeg', leg)
  samples.push({ id: 'neon', name: 'Neon', model: 'slim', png: skin.png })
}

// 3. Moss Knight — weathered armor with a cape.
{
  const steel = hex('#8d99ae')
  const steelDark = hex('#5c677d')
  const moss = hex('#6a994e')
  const cape = hex('#9d2b2b')
  const skinTone = hex('#a47551')
  const skin = createSkin(4, 37)
  skin.paint('head', face({ skin: skinTone, hair: hex('#1f1a17'), iris: hex('#3d5a80'), brow: hex('#1f1a17'), mouth: hex('#5e3023') }))
  skin.paint('hat', (f, px, py, w) => {
    if (f === 'bottom') return null
    if (f === 'top') return (px + py) % 5 === 0 ? moss : steel
    if (f === 'front') {
      if (py === 4 && px >= 1 && px <= 6) return null
      if (py >= 5 && px >= 2 && px <= 5) return null
      if (px === 3 || px === 4) return py < 4 ? steelDark : null
      return py === 0 ? steelDark : steel
    }
    if (py === 0 || px === 0 || px === w - 1) return steelDark
    return (px * 3 + py) % 7 === 0 ? moss : steel
  })
  skin.paint('body', (f, px, py) => {
    if (py >= 10) return steelDark
    if (f === 'front' && py >= 2 && py <= 6 && px >= 2 && px <= 5) {
      return px === 2 || px === 5 || py === 2 ? hex('#d4a373') : moss
    }
    if (f === 'back') return cape
    return py === 9 ? hex('#4a3728') : steel
  })
  skin.paint('jacket', (f, px, py) => {
    if (f === 'back') return py < 11 ? mix(cape, [0, 0, 0, 255], py / 40) : null
    if (f === 'top' && px > 0 && px < 7) return cape
    return null
  })
  const arm = (f, px, py) => {
    if (py < 4) return py === 0 || py === 3 ? steelDark : steel
    if (py >= 10) return steelDark
    return (px + py) % 6 === 0 ? moss : steel
  }
  skin.paint('rightArm', arm)
  skin.paint('leftArm', arm)
  const leg = (f, px, py) => {
    if (py >= 9) return steelDark
    if (py === 4) return steelDark
    return (px + py * 2) % 7 === 0 ? moss : steel
  }
  skin.paint('rightLeg', leg)
  skin.paint('leftLeg', leg)
  samples.push({ id: 'moss-knight', name: 'Moss Knight', model: 'classic', png: skin.png })
}

// 4. Astro — spacesuit with a glowing visor.
{
  const suit = hex('#eef0f2')
  const suitShade = hex('#c9ced6')
  const orange = hex('#ff7a1a')
  const visor = hex('#13213a')
  const glow = hex('#4cc9f0')
  const skin = createSkin(4, 53)
  skin.paint('head', (f, px, py) => {
    if (f === 'front') {
      if (py >= 2 && py <= 5 && px >= 1 && px <= 6) {
        if (py === 2 && px >= 4) return glow
        if (py === 3 && px === 5) return glow
        return visor
      }
      return py === 7 ? suitShade : suit
    }
    if (f === 'top') return px === 3 || px === 4 ? orange : suit
    if (f === 'back') return py === 7 ? suitShade : suit
    if (f === 'bottom') return suitShade
    return py === 4 && (px === 3 || px === 4) ? suitShade : suit
  })
  skin.paint('hat', (f, px, py) => {
    if (f === 'right' || f === 'left') return py >= 3 && py <= 5 && px >= 3 && px <= 5 ? suitShade : null
    return null
  })
  skin.paint('body', (f, px, py) => {
    if (f === 'front') {
      if (py >= 2 && py <= 3 && px >= 1 && px <= 2) return hex('#3a86ff')
      if (py >= 2 && py <= 4 && px >= 5 && px <= 6) return py === 3 ? orange : suitShade
    }
    if (py === 9) return orange
    if (py >= 10) return suitShade
    return suit
  })
  skin.paint('jacket', (f, px, py) => {
    if (f === 'back' && py >= 1 && py <= 8 && px >= 1 && px <= 6) {
      if (py === 3 && px >= 2 && px <= 5) return glow
      return px === 1 || px === 6 ? suitShade : hex('#b5bcc6')
    }
    return null
  })
  const arm = (f, px, py) => {
    if (py === 5) return orange
    if (py >= 10) return suitShade
    return suit
  }
  skin.paint('rightArm', arm)
  skin.paint('leftArm', arm)
  const leg = (f, px, py) => {
    if (py === 6) return orange
    if (py >= 9) return py === 11 ? hex('#4a4e69') : hex('#9aa1ad')
    return suit
  }
  skin.paint('rightLeg', leg)
  skin.paint('leftLeg', leg)
  samples.push({ id: 'astro', name: 'Astro', model: 'classic', png: skin.png })
}

await fs.mkdir(OUT_DIR, { recursive: true })
for (const sample of samples) {
  await fs.writeFile(new URL(`${sample.id}.png`, OUT_DIR), PNG.sync.write(sample.png))
}
console.log(`Wrote ${samples.length} sample skins to public/samples`)
