# Skinforge

Turn any Minecraft skin into a posed 3D statue, preview it block by block, and
export it for WorldEdit, Litematica, or plain vanilla commands.

## What it does

**Skins in**
- Upload, drag and drop anywhere, or paste (Ctrl+V) a 64x64 or legacy 64x32 PNG.
- Load a player's skin by username, or start from one of four original sample skins.
- Slim (3 px arm) skins are detected automatically; you can force Classic or Slim.
- Legacy 64x32 skins are converted the way the game does it: left limbs mirror the
  right ones, and an all-opaque hat layer is treated as transparent.

**Statue**
- Poses: Stand, Stride, Wave, Victory, T-pose, Zombie, Dab, or Custom with
  per-joint sliders. Limbs are rasterized at the final size, so rotated arms stay
  solid and smoother at bigger scales.
- Sizes from 1x (32 blocks tall) to 4x (128 blocks tall).
- The overlay layer (hats, jackets, sleeves) can be off, merged into the base, or
  built as a real 3D layer with sealed edges.
- Smart hollowing keeps only the blocks you can see. Pick a 1 to 3 block shell, or
  fill the inside with a cheap block like stone or cobblestone.
- Optional pedestal under the feet.
- Brightness, contrast, and saturation tuning before block matching.

**Blocks**
- Eight palettes, led by Survival Max: 407 full blocks indexed from the game's own
  textures, matched per visible face in OKLab.
- Survival filters skip functional blocks, falling or dying blocks, see-through
  blocks, and silk-touch ores or precious blocks.
- Ban any block from the materials list and the statue re-matches instantly.

**Preview and planning**
- WebGL preview with Blocks, Skin, and Match (accuracy heatmap) color modes,
  camera presets, auto-rotate, block outlines, screenshots, and full screen.
- Hover any block to see its name, position, and color error.
- Layer slicer plus a top-down layer-by-layer build guide.
- Survival material list in stacks and shulker boxes, with copy and CSV export.

**Exports**
| Format | Works with |
| --- | --- |
| Sponge `.schem` (v2) | WorldEdit, FastAsyncWorldEdit, Axiom, Amulet |
| Litematica `.litematic` | Litematica mod (hologram guide and material list) |
| Vanilla `.mcfunction` | Any datapack, no mods. Runs of blocks become `fill` commands |

Exports target Java 26.2 (DataVersion 4903). The statue faces north and its origin
is the bottom north-west corner.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `O` | Open a skin file |
| `Ctrl V` | Paste a skin image |
| `E` | Export |
| `1` to `5` | Front, side, back, top, 3D views |
| `F` | Frame the statue (double-click works too) |
| `R` | Auto-rotate |
| `G` | Block outlines |
| `M` | Cycle color modes |
| `[` and `]` | Step through layers |
| `Esc` | Show every layer |
| `?` | Shortcut list |

## Run it

```bash
npm install
npm run dev
```

Then open the local URL Vite prints, for example `http://localhost:5173/`.

## Check it

```bash
npm test        # converter, pose, hollowing, and export round-trip tests
npm run lint
npm run build
```

The production build warns that the main chunk is over 500 kB because it ships
Three.js for the preview.

## Regenerate data

```bash
npm run generate:palette   # Survival Max palette from the official client jar
npm run generate:samples   # the four sample skins in public/samples
```

## Notes on accuracy

- Skins map onto the vanilla player model UVs, including the top-face orientation
  and the 3 px slim arms.
- Statues are not mirrored: a word on a shirt reads correctly from the front.
- Username lookups go through public skin mirrors (mc-heads.net, then
  minotar.net). If both are down, download the PNG and drop it in.
