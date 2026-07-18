# Skin Schematic Forge

Turns your Minecraft skin into a 3D schematic you can build in your world.

## Features

- Loads modern `64x64` skins and legacy `64x32` skins.
- Maps skin UV faces onto a blocky Minecraft player sculpture.
- Supports base skin and hat/overlay layers.
- Includes scale, shell thickness, overlay mode, and block palette controls.
- Provides Skin Match, Skin Tones, Natural Blocks, Concrete, Concrete Powder,
  Wool, Terracotta, and Mixed palette options.
- Mixed is generated from Minecraft `1.21.8` assets and searches stable, opaque,
  texture-uniform survival full blocks. Transparent, falling, ticking, container,
  workstation, and face-mismatched blocks are excluded before color matching.
- Exports gzip-compressed Sponge `.schem` files with complete block states and the
  Minecraft `1.21.8` data version (`4440`).
- Exports legacy `.schematic` files using wool color data for older tools.
- Shows an interactive Three.js voxel preview before export.

## Run

Download the code, open the code folder in your terminal, and run:

```bash
npm install
npm run dev
```

Then open the local URL Vite prints, for example `http://127.0.0.1:5174/`.

## Verify

```bash
npm run lint
npm run build
```

The production build can warn that the JavaScript chunk is larger than 500 kB because the app ships a client-side Three.js preview.

Regenerate the data-driven Mixed palette after dependency updates:

```bash
npm run generate:palette
```

## Schematic compatibility

Use a Java 1.21.8-compatible WorldEdit or schematic importer for modern `.schem`
exports. Importers targeting older Minecraft versions do not know newer block
identifiers and may replace them with air. Use the legacy `.schematic` option when
working with an older tool that accepts classic wool ID/data schematics.

For a manual export check, try a skin with base and semi-transparent overlay pixels,
import both a Skin Match and Mixed `.schem`, and confirm the statue dimensions,
front/back orientation, overlay colors, and block palette in the target world.
