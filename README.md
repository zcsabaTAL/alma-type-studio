# ALMA Type Studio

**Live App:** https://zcsabatal.github.io/alma-type-studio/

Parametric hand-lettered font studio and Grinch Christmas greeting card maker built with React, TypeScript, Vite, 2D SDF + Marching Squares vectorization, OpenType `GPOS`/`kern` injection, and `opentype.js`.

## Features

- **Sketch DNA & 6 Extracted Pieces**: Built around a hand-drawn `ALMA` coral Post-it sketch (`public/alma-sketch.jpg`), with real client-side `<canvas>` ink extraction and custom sketch upload.
- **Parametric SDF Vector Engine**: Real-time `Piece variation`, `Exaggeration`, `Joint melt` (2D SDF smooth-minimum), `Counter pinch`, `Limb drop`, `Baseline bounce`, `Waist height`, and `Stroke weight` sliders, with full Hungarian accented glyph support (`ÁÉÍÓÖŐÚÜŰ áéíóöőúüű`).
- **Glyphs & Interactive Bézier Editor**: 94-glyph character table with live anchor/handle editing, corner/smooth toggle, point insertion/deletion, undo, and procedural reset.
- **Test & Kerning Lab**: Optical 28-band contour-profile kerning calculator, custom SFNT binary injector writing both `GPOS` (PairPos Format 1) and `kern` (Format 0) tables, live `@font-face` compiled `.ttf` binary tester, and 3-weight family `.zip` export (`Regular`, `Bold`, `Molten Display`).
- **Grinch Christmas Card Studio**: 5 festive themes, Hungarian message presets, custom photo upload (Polaroid, Rounded, Circle, Full-bleed background), direct on-canvas drag/scale/rotate for every element, and 2x HD PNG / print-ready SVG export.

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5179/.
