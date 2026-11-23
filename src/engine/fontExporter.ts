import opentype from 'opentype.js';
import {
  ConstructionParams,
  FontFamilyWeight,
  GlyphData,
  TypesettingParams,
} from '../types/font';
import { ALL_SUPPORTED_CHARS } from './glyphBlueprints';
import {
  ASCENDER,
  DESCENDER,
  UPM,
  generateProceduralGlyph,
  glyphToSvgPath,
} from './sdfVectorizer';
import { computeOpticalKerning } from './kerningEngine';
import { GlyphKernPair, injectKerningTables } from './sfntKerningPatcher';
import { buildZipArchive } from './zipPackager';

export interface CompiledFontResult {
  buffer: ArrayBuffer;
  fileName: string;
  styleName: string;
  weightClass: number;
  byteLength: number;
  glyphCount: number;
  kerningPairCount: number;
}

function glyphDataToOpentypePath(glyphData: GlyphData): opentype.Path {
  const path = new opentype.Path();
  for (const contour of glyphData.contours) {
    const pts = contour.points;
    if (pts.length < 2) continue;

    path.moveTo(Math.round(pts[0].x), Math.round(pts[0].y));
    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % pts.length];
      path.curveTo(
        Math.round(curr.outX),
        Math.round(curr.outY),
        Math.round(next.inX),
        Math.round(next.inY),
        Math.round(next.x),
        Math.round(next.y)
      );
    }
    path.close();
  }
  return path;
}

export function deriveWeightVariantParams(
  base: ConstructionParams,
  variant: FontFamilyWeight
): { params: ConstructionParams; styleName: string; weightClass: number; isBold: boolean } {
  if (variant === 'bold') {
    return {
      styleName: 'Bold',
      weightClass: 700,
      isBold: true,
      params: {
        ...base,
        strokeWeight: Math.min(74, base.strokeWeight + 18),
        jointMelt: Math.min(100, base.jointMelt + 14),
        counterPinch: Math.min(100, base.counterPinch + 10),
      },
    };
  }
  if (variant === 'molten') {
    return {
      styleName: 'Molten Display',
      weightClass: 900,
      isBold: true,
      params: {
        ...base,
        strokeWeight: Math.min(74, Math.max(54, base.strokeWeight + 20)),
        jointMelt: Math.max(78, Math.min(100, base.jointMelt + 45)),
        counterPinch: Math.max(42, Math.min(100, base.counterPinch + 20)),
      },
    };
  }
  return {
    styleName: 'Regular',
    weightClass: 400,
    isBold: false,
    params: base,
  };
}

export function compileTrueTypeFontBuffer(
  familyName: string,
  params: ConstructionParams,
  overrides: Record<string, GlyphData>,
  kerningMap: Record<string, number>,
  options?: {
    styleName?: string;
    weightClass?: number;
    isBold?: boolean;
  }
): CompiledFontResult {
  const styleName = options?.styleName ?? 'Regular';
  const weightClass = options?.weightClass ?? 400;
  const isBold = options?.isBold ?? weightClass >= 700;

  const notdefPath = new opentype.Path();
  notdefPath.moveTo(100, 0);
  notdefPath.lineTo(100, 700);
  notdefPath.lineTo(500, 700);
  notdefPath.lineTo(500, 0);
  notdefPath.close();

  const notdefGlyph = new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: 600,
    path: notdefPath,
  });

  const glyphs: opentype.Glyph[] = [notdefGlyph];
  const charToGlyphId = new Map<string, number>();

  for (const char of ALL_SUPPORTED_CHARS) {
    const data = overrides[char] ?? generateProceduralGlyph(char, params);
    const unicode = char.codePointAt(0) ?? 32;
    const glyphName =
      char === ' '
        ? 'space'
        : `uni${unicode.toString(16).toUpperCase().padStart(4, '0')}`;

    const glyphId = glyphs.length;
    charToGlyphId.set(char, glyphId);

    glyphs.push(
      new opentype.Glyph({
        name: glyphName,
        unicode,
        advanceWidth: Math.max(160, Math.round(data.advanceWidth)),
        path: glyphDataToOpentypePath(data),
      })
    );
  }

  const cleanFamily = familyName.trim() || 'ALMA Studio';
  const font = new opentype.Font({
    familyName: cleanFamily,
    styleName,
    unitsPerEm: UPM,
    ascender: ASCENDER,
    descender: DESCENDER,
    glyphs,
  });

  // Set proper OS/2 weight class & style flags so macOS Font Book / Figma / PowerPoint group the family
  const fontTables = (font as unknown as { tables: Record<string, unknown> }).tables;
  fontTables.os2 = {
    ...(typeof fontTables.os2 === 'object' && fontTables.os2 ? fontTables.os2 : {}),
    usWeightClass: weightClass,
    fsSelection: isBold ? 0x0020 : 0x0040,
  };

  const baseBuffer = font.toArrayBuffer();

  // Map character kerning pairs -> Glyph ID pairs and inject real GPOS + kern tables
  const glyphPairs: GlyphKernPair[] = [];
  for (const [pairKey, value] of Object.entries(kerningMap)) {
    if (!value) continue;
    const chars = [...pairKey];
    if (chars.length !== 2) continue;
    const leftGlyphId = charToGlyphId.get(chars[0]);
    const rightGlyphId = charToGlyphId.get(chars[1]);
    if (leftGlyphId && rightGlyphId) {
      glyphPairs.push({ leftGlyphId, rightGlyphId, value: Math.round(value) });
    }
  }

  const finalBuffer = injectKerningTables(baseBuffer, glyphPairs);
  const safeFamily = cleanFamily.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const safeStyle = styleName.replace(/[^a-zA-Z0-9_-]+/g, '');
  const fileName = `${safeFamily}-${safeStyle}.ttf`;

  return {
    buffer: finalBuffer,
    fileName,
    styleName,
    weightClass,
    byteLength: finalBuffer.byteLength,
    glyphCount: font.glyphs.length,
    kerningPairCount: glyphPairs.length,
  };
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadTrueTypeFont(
  familyName: string,
  params: ConstructionParams,
  overrides: Record<string, GlyphData>,
  kerningMap: Record<string, number>
): CompiledFontResult {
  const compiled = compileTrueTypeFontBuffer(
    familyName,
    params,
    overrides,
    kerningMap
  );
  triggerBlobDownload(
    new Blob([compiled.buffer], { type: 'font/ttf' }),
    compiled.fileName
  );
  return compiled;
}

export function downloadFontFamilyZip(
  familyName: string,
  baseParams: ConstructionParams,
  overrides: Record<string, GlyphData>,
  kerningStrength: number,
  manualKerning: Record<string, number>
): {
  zipFileName: string;
  totalBytes: number;
  variants: CompiledFontResult[];
} {
  const cleanFamily = familyName.trim() || 'ALMA Studio';
  const safeFamily = cleanFamily.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const variantKeys: FontFamilyWeight[] = ['regular', 'bold', 'molten'];

  const variants: CompiledFontResult[] = variantKeys.map((variant) => {
    const derived = deriveWeightVariantParams(baseParams, variant);
    // Apply manual glyph overrides only to Regular so Bold/Molten weights stay cleanly proportional
    const variantOverrides = variant === 'regular' ? overrides : {};
    const { kerningMap } = computeOpticalKerning(
      derived.params,
      variantOverrides,
      kerningStrength,
      manualKerning
    );
    return compileTrueTypeFontBuffer(
      cleanFamily,
      derived.params,
      variantOverrides,
      kerningMap,
      {
        styleName: derived.styleName,
        weightClass: derived.weightClass,
        isBold: derived.isBold,
      }
    );
  });

  const readme = [
    `${cleanFamily} — Parametric Font Family`,
    `Generated by ALMA Type Studio`,
    ``,
    `Included weights (all with Hungarian accents + OpenType GPOS & kern tables):`,
    ...variants.map(
      (v) =>
        `  - ${v.fileName} (Weight ${v.weightClass}, ${v.glyphCount} glyphs, ${v.kerningPairCount} kerning pairs, ${(v.byteLength / 1024).toFixed(1)} KB)`
    ),
    ``,
    `Telepites (macOS): Jelold ki mindharom .ttf fajlt -> dupla kattintas -> Install Font.`,
    `Telepites (Windows): Jobb klikk -> Telepites minden felhasznalonak.`,
  ].join('\n');

  const zipBlob = buildZipArchive([
    ...variants.map((v) => ({
      name: v.fileName,
      data: new Uint8Array(v.buffer),
    })),
    {
      name: 'README.txt',
      data: new TextEncoder().encode(readme),
    },
  ]);

  const zipFileName = `${safeFamily}-Family.zip`;
  triggerBlobDownload(zipBlob, zipFileName);

  return {
    zipFileName,
    totalBytes: zipBlob.size,
    variants,
  };
}

export function downloadSpecimenSvg(
  text: string,
  familyName: string,
  params: ConstructionParams,
  typesetting: TypesettingParams,
  overrides: Record<string, GlyphData>,
  kerningMap: Record<string, number>
): string {
  const lines = text.split('\n');
  const scale = typesetting.fontSize / UPM;
  const lineAdvance = typesetting.fontSize * typesetting.lineHeight;
  const padX = 48;
  const padY = 56;

  let maxWidth = 300;
  const linePaths: string[] = [];

  lines.forEach((line, lineIdx) => {
    let cursorX = padX;
    const baseY = padY + lineIdx * lineAdvance;
    const chars = [...line];

    chars.forEach((ch, cIdx) => {
      const glyph = overrides[ch] ?? generateProceduralGlyph(ch, params);
      if (glyph.contours.length > 0) {
        const d = glyphToSvgPath(glyph.contours, ASCENDER);
        const fill =
          typesetting.renderMode === 'solid' ? '#F5F2EB' : 'none';
        const stroke =
          typesetting.renderMode === 'outline' ? '#F5F2EB' : 'none';
        const strokeWidth =
          typesetting.renderMode === 'outline' ? Math.max(12, 18 / Math.max(0.4, scale)) : 0;
        linePaths.push(
          `<g transform="translate(${cursorX.toFixed(1)}, ${baseY.toFixed(1)}) scale(${scale.toFixed(4)})"><path d="${d}" fill="${fill}" fill-rule="nonzero" stroke="${stroke}" stroke-width="${strokeWidth.toFixed(1)}" stroke-linejoin="round" /></g>`
        );
      }
      const nextCh = chars[cIdx + 1];
      const kern = nextCh ? kerningMap[`${ch}${nextCh}`] ?? 0 : 0;
      cursorX += (glyph.advanceWidth + kern + typesetting.letterSpacing) * scale;
    });

    if (cursorX + padX > maxWidth) maxWidth = cursorX + padX;
  });

  const totalHeight = Math.max(
    240,
    padY * 2 + lines.length * lineAdvance + Math.abs(DESCENDER) * scale
  );

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(maxWidth)} ${Math.ceil(totalHeight)}" width="${Math.ceil(maxWidth)}" height="${Math.ceil(totalHeight)}">
  <rect width="100%" height="100%" fill="#111216" />
  ${linePaths.join('\n  ')}
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const safeName = (familyName.trim() || 'ALMA-Studio').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const fileName = `${safeName}-Specimen.svg`;
  triggerBlobDownload(blob, fileName);

  return fileName;
}
