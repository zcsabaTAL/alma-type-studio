import React, { useMemo } from 'react';
import { ConstructionParams, GlyphData, TypesettingParams } from '../types/font';
import {
  ASCENDER,
  CAP_HEIGHT,
  DESCENDER,
  UPM,
  generateProceduralGlyph,
  glyphToSvgPath,
} from '../engine/sdfVectorizer';
import { GLYPH_BLUEPRINTS } from '../engine/glyphBlueprints';

interface StudioCanvasProps {
  text: string;
  onTextChange: (next: string) => void;
  params: ConstructionParams;
  typesetting: TypesettingParams;
  overrides: Record<string, GlyphData>;
  kerningMap: Record<string, number>;
  onSelectGlyphToEdit: (char: string) => void;
  onThemeChange: (theme: TypesettingParams['canvasTheme']) => void;
}

const SPECIMEN_SAMPLES = [
  { label: 'ALMA + Magyar', text: 'ALMA\nÁrvíztűrő tükörfúrógép\n0123456789' },
  { label: 'ALMA Post-it', text: 'ALMA' },
  { label: 'Kerning teszt', text: 'AVATAR · TÁVOL\nWAVE · PÁLYA · FÁK' },
  { label: 'Magyar nagybetűk', text: 'ÁÉÍÓÖŐÚÜŰ\náéíóöőúüű' },
];

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  text,
  onTextChange,
  params,
  typesetting,
  overrides,
  kerningMap,
  onSelectGlyphToEdit,
  onThemeChange,
}) => {
  const lines = useMemo(() => text.split('\n'), [text]);
  const scale = typesetting.fontSize / UPM;
  const lineAdvance = typesetting.fontSize * typesetting.lineHeight;
  const padX = 56;
  const padY = 58;

  const renderedLines = useMemo(() => {
    let maxW = 680;
    const rows = lines.map((line, lineIdx) => {
      let cursorX = padX;
      const baseY = padY + lineIdx * lineAdvance;
      const items: {
        key: string;
        char: string;
        x: number;
        y: number;
        d: string;
        width: number;
        isOverride: boolean;
      }[] = [];

      const chars = [...line];
      const resolvedChars = chars.map((ch) =>
        ch in GLYPH_BLUEPRINTS
          ? ch
          : ch.toUpperCase() in GLYPH_BLUEPRINTS
            ? ch.toUpperCase()
            : ' '
      );

      resolvedChars.forEach((resolvedChar, cIdx) => {
        const glyph = overrides[resolvedChar] ?? generateProceduralGlyph(resolvedChar, params);
        const d = glyph.contours.length > 0 ? glyphToSvgPath(glyph.contours, ASCENDER) : '';
        items.push({
          key: `${lineIdx}-${cIdx}-${resolvedChar}`,
          char: resolvedChar,
          x: cursorX,
          y: baseY,
          d,
          width: glyph.advanceWidth * scale,
          isOverride: !!overrides[resolvedChar],
        });
        const nextChar = resolvedChars[cIdx + 1];
        const kern = nextChar ? kerningMap[`${resolvedChar}${nextChar}`] ?? 0 : 0;
        cursorX += (glyph.advanceWidth + kern + typesetting.letterSpacing) * scale;
      });

      if (cursorX + padX > maxW) maxW = cursorX + padX;
      return { baseY, items, endX: cursorX };
    });

    const totalHeight = Math.max(
      420,
      padY * 2 + Math.max(1, lines.length) * lineAdvance + Math.abs(DESCENDER) * scale + 30
    );

    return { rows, width: Math.ceil(maxW), height: Math.ceil(totalHeight) };
  }, [lines, params, overrides, kerningMap, scale, lineAdvance, typesetting.letterSpacing]);

  const palette =
    typesetting.canvasTheme === 'postit'
      ? { bg: '#ee624a', ink: '#181a2a', guide: 'rgba(24,26,42,0.22)', accent: '#181a2a' }
      : typesetting.canvasTheme === 'paper'
        ? { bg: '#f4f1ea', ink: '#15161c', guide: 'rgba(21,22,28,0.16)', accent: '#e0553c' }
        : { bg: '#101116', ink: '#f5f2eb', guide: 'rgba(255,255,255,0.11)', accent: '#ff6e54' };

  const strokeW = Math.max(11, 18 / Math.max(0.45, scale));
  const waistY = (params.waistHeight / 100) * CAP_HEIGHT;
  const activeKernCount = Object.keys(kerningMap).length;

  return (
    <section className="studio-canvas-shell" aria-label="Élő betűtípus előnézet">
      <div className="canvas-toolbar">
        <div className="sample-pills" role="group" aria-label="Minta szövegek">
          {SPECIMEN_SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              className={`pill-btn ${text === s.text ? 'is-active' : ''}`}
              onClick={() => onTextChange(s.text)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="theme-swatches" role="group" aria-label="Vászon háttér">
          <button
            type="button"
            className={`swatch-btn ${typesetting.canvasTheme === 'dark' ? 'is-active' : ''}`}
            onClick={() => onThemeChange('dark')}
            title="Sötét stúdió"
          >
            <span className="swatch-dot" style={{ background: '#14161d' }} />
            Dark
          </button>
          <button
            type="button"
            className={`swatch-btn ${typesetting.canvasTheme === 'postit' ? 'is-active' : ''}`}
            onClick={() => onThemeChange('postit')}
            title="ALMA korall Post-it háttér"
          >
            <span className="swatch-dot" style={{ background: '#ee624a' }} />
            Post-it
          </button>
          <button
            type="button"
            className={`swatch-btn ${typesetting.canvasTheme === 'paper' ? 'is-active' : ''}`}
            onClick={() => onThemeChange('paper')}
            title="Világos papír"
          >
            <span className="swatch-dot" style={{ background: '#f4f1ea' }} />
            Papír
          </button>
        </div>
      </div>

      <div
        className="specimen-stage"
        style={{ backgroundColor: palette.bg }}
      >
        <svg
          className="specimen-svg"
          viewBox={`0 0 ${renderedLines.width} ${renderedLines.height}`}
          style={{ minWidth: '100%', height: 'auto', minHeight: '420px' }}
        >
          {renderedLines.rows.map((row, idx) => (
            <g key={idx}>
              {typesetting.showMetrics && (
                <g className="metric-guides">
                  <line
                    x1={24}
                    x2={renderedLines.width - 24}
                    y1={row.baseY + (ASCENDER - CAP_HEIGHT) * scale}
                    y2={row.baseY + (ASCENDER - CAP_HEIGHT) * scale}
                    stroke={palette.guide}
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                  <line
                    x1={24}
                    x2={renderedLines.width - 24}
                    y1={row.baseY + (ASCENDER - waistY) * scale}
                    y2={row.baseY + (ASCENDER - waistY) * scale}
                    stroke={palette.accent}
                    strokeOpacity={0.35}
                    strokeDasharray="2 5"
                    strokeWidth={1}
                  />
                  <line
                    x1={24}
                    x2={renderedLines.width - 24}
                    y1={row.baseY + ASCENDER * scale}
                    y2={row.baseY + ASCENDER * scale}
                    stroke={palette.guide}
                    strokeWidth={1.2}
                  />
                  <line
                    x1={24}
                    x2={renderedLines.width - 24}
                    y1={row.baseY + (ASCENDER - DESCENDER) * scale}
                    y2={row.baseY + (ASCENDER - DESCENDER) * scale}
                    stroke={palette.guide}
                    strokeDasharray="2 6"
                    strokeWidth={1}
                  />
                </g>
              )}

              {row.items.map((item) =>
                item.d ? (
                  <g
                    key={item.key}
                    className="specimen-glyph-hit"
                    transform={`translate(${item.x}, ${item.y}) scale(${scale})`}
                    onClick={() => onSelectGlyphToEdit(item.char)}
                  >
                    <title>Kattints a „{item.char}” karakter Bézier-szerkesztéséhez</title>
                    <path
                      d={item.d}
                      fill={typesetting.renderMode === 'solid' ? palette.ink : 'none'}
                      fillRule="nonzero"
                      stroke={typesetting.renderMode === 'outline' ? palette.ink : 'transparent'}
                      strokeWidth={typesetting.renderMode === 'outline' ? strokeW : 0}
                      strokeLinejoin="round"
                    />
                    {item.isOverride && (
                      <circle
                        cx={120}
                        cy={ASCENDER + 70}
                        r={26}
                        fill={palette.accent}
                        opacity={0.9}
                      />
                    )}
                  </g>
                ) : null
              )}
            </g>
          ))}
        </svg>

        <div className="canvas-hint">
          Kattints bármelyik betűre a Bézier-szerkesztéshez · Optikai kerning aktív ({activeKernCount} pár)
        </div>
      </div>

      <div className="text-editor-bar">
        <label htmlFor="specimen-textarea" className="sr-only">
          Szedendő próbaszöveg
        </label>
        <textarea
          id="specimen-textarea"
          className="specimen-input"
          rows={3}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Írj be bármilyen magyar vagy angol szöveget..."
          spellCheck={false}
        />
      </div>
    </section>
  );
};
