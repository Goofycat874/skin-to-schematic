# Schematic Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make exported schematics use valid, version-correct block states and avoid palette choices that disappear, mutate, fall, or render misleadingly after import.

**Architecture:** Keep the existing Sponge v2 and legacy writers, but make the generated Minecraft palette the source of truth for the Minecraft data version and for canonical default block-state strings. Filter the broad Mixed palette at generation time so runtime conversion can only select stable full blocks. Improve flattened overlay mapping by alpha-compositing it with the base skin before choosing a block.

**Tech Stack:** React, browser-side JavaScript, Sponge Schematic v2/NBT, `minecraft-data`, `minecraft-assets`.

---

### Task 1: Canonical modern schematic metadata

**Files:**
- Modify: `scripts/generateSurvivalMixedPalette.mjs`
- Modify: `src/generated/survivalMixedPalette.js`
- Modify: `src/lib/schematicWriters.js`

1. Export the exact Minecraft `DataVersion` alongside the generated Mixed palette.
2. Build complete default block-state identifiers, including alphabetically ordered properties.
3. Use that generated data version in every modern `.schem` export.
4. Reject malformed dimensions, coordinates, legacy values, and block-state strings before writing NBT.

### Task 2: Stable, visually reliable Mixed palette

**Files:**
- Modify: `scripts/generateSurvivalMixedPalette.mjs`
- Modify: `src/generated/survivalMixedPalette.js`
- Modify: `src/lib/palettes.js`

1. Exclude transparent, gravity-affected, ticking/mutating, container/workstation, block-entity, and strongly face-patterned blocks from Mixed.
2. Keep full-collision, obtainable, stable blocks and serialize their explicit default state.
3. Regenerate the checked-in palette artifact from Minecraft 1.21.8 data.
4. Update UI descriptions to explain that Mixed uses stable full blocks.

### Task 3: Correct flattened overlays

**Files:**
- Modify: `src/lib/skinModel.js`

1. Distinguish overlay conversion from base conversion.
2. For merged overlays, alpha-composite semi-transparent overlay pixels over the underlying base source color.
3. Run nearest-block selection on the resulting visible color while preserving shell mode behavior.

### Task 4: Manual verification handoff

**Files:**
- Modify: `README.md`

1. Document Minecraft 1.21.8/DataVersion compatibility and stable Mixed-palette behavior.
2. Provide focused in-game/importer checks for the user to run.
3. Do not run the project test, lint, build, or browser verification commands; the user requested to perform testing personally.
