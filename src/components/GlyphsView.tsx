import React, { useMemo } from 'react';
import { ConstructionParams, GlyphData, TypesettingParams } from '../types/font';
import { CHARACTER_GROUPS } from '../engine/glyphBlueprints';
import {
  ASCENDER,
  DESCENDER,
  generateProceduralGlyph,
  glyphToSvgPath,
} from '../engine/sdfVectorizer';
import { BezierEditor } from './BezierEditor';

interface GlyphsViewProps {
  params: ConstructionParams;
  typesetting: TypesettingParams;
  overrides: Record<string, GlyphData>;
  editingChar: string | null;
  onSelectChar: (char: string | null) => void;
  onSaveOverride: (char: string, updated: GlyphData) => void;
  onResetOverride: (char: string) => void;
}

export const GlyphsView: React.FC<GlyphsViewProps> = ({
  params,
  typesetting,
  overrides,
  editingChar,
  onSelectChar,
  onSaveOverride,
  onResetOverride,
}) => {
  const editingProcedural = useMemo(
    () => (editingChar ? generateProceduralGlyph(editingChar, params) : null),
    [editingChar, params]
  );

  if (editingChar && editingProcedural) {
    const activeGlyph = overrides[editingChar] ?? editingProcedural;
    return (
      <BezierEditor
        char={editingChar}
        glyph={activeGlyph}
        proceduralGlyph={editingProcedural}
        onSaveOverride={onSaveOverride}
        onResetOverride={onResetOverride}
        onBack={() => onSelectChar(null)}
      />
    );
  }

  return (
    <section className="glyphs-grid-shell" aria-label="Teljes karaktertábla">
      <div className="glyphs-intro">
        <div>
          <h2>Karaktertábla ({Object.keys(overrides).length} egyedileg szerkesztett)</h2>
          <p>
            Kattints bármelyik betűre (pl. <strong>h</strong>, <strong>A</strong>, <strong>ő</strong>) a beépített Bézier-szerkesztő megnyitásához.
          </p>
        </div>
      </div>

      {CHARACTER_GROUPS.map((group) => (
        <div key={group.id} className="glyph-group">
          <h3 className="glyph-group-title">{group.label}</h3>
          <div className="glyph-cards-grid">
            {group.chars.map((ch) => {
              const glyph = overrides[ch] ?? generateProceduralGlyph(ch, params);
              const d = glyphToSvgPath(glyph.contours, ASCENDER);
              const viewW = Math.max(660, glyph.advanceWidth + 120);
              const viewH = ASCENDER - DESCENDER + 80;
              const isEdited = !!overrides[ch];

              return (
                <button
                  key={ch}
                  type="button"
                  className={`glyph-card ${isEdited ? 'is-edited' : ''}`}
                  onClick={() => onSelectChar(ch)}
                  title={`„${ch}” szerkesztése Bézier-görbékkel`}
                >
                  <div className="glyph-card-top">
                    <span className="glyph-card-label">{ch}</span>
                    {isEdited && <span className="edited-pill">Edited</span>}
                  </div>
                  <svg
                    className="glyph-card-svg"
                    viewBox={`-40 -40 ${viewW} ${viewH}`}
                    aria-hidden="true"
                  >
                    <line
                      x1={-40}
                      x2={viewW - 40}
                      y1={ASCENDER}
                      y2={ASCENDER}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth={6}
                    />
                    <path
                      d={d}
                      fill={typesetting.renderMode === 'solid' ? '#f5f2eb' : 'none'}
                      fillRule="nonzero"
                      stroke={typesetting.renderMode === 'outline' ? '#f5f2eb' : 'none'}
                      strokeWidth={typesetting.renderMode === 'outline' ? 22 : 0}
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
};
