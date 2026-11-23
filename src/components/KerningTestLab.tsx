import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Package,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  ConstructionParams,
  FontFamilyWeight,
  GlyphData,
} from '../types/font';
import {
  CompiledFontResult,
  compileTrueTypeFontBuffer,
  deriveWeightVariantParams,
} from '../engine/fontExporter';
import { KerningPairEntry, computeOpticalKerning } from '../engine/kerningEngine';
import { RangeSlider } from './RangeSlider';

interface KerningTestLabProps {
  fontName: string;
  params: ConstructionParams;
  overrides: Record<string, GlyphData>;
  kerningStrength: number;
  onKerningStrengthChange: (val: number) => void;
  manualKerning: Record<string, number>;
  onManualKerningChange: (next: Record<string, number>) => void;
  onDownloadFamilyZip: () => void;
}

type MockupType = 'slide' | 'poster' | 'pairs';

export const KerningTestLab: React.FC<KerningTestLabProps> = ({
  fontName,
  params,
  overrides,
  kerningStrength,
  onKerningStrengthChange,
  manualKerning,
  onManualKerningChange,
  onDownloadFamilyZip,
}) => {
  const [previewWeight, setPreviewWeight] = useState<FontFamilyWeight>('regular');
  const [kerningEnabled, setKerningEnabled] = useState(true);
  const [mockup, setMockup] = useState<MockupType>('slide');
  const [selectedPairKey, setSelectedPairKey] = useState<string>('AV');
  const [customPairInput, setCustomPairInput] = useState('');

  // Editable live mockup text fields
  const [slideTitle, setSlideTitle] = useState('ALMA · AI LAB 2026');
  const [slideSubtitle, setSlideSubtitle] = useState(
    'AVATAR · TÁVOL · WAVE · Árvíztűrő tükörfúrógép'
  );
  const [posterText, setPosterText] = useState('ALMA\nTÁVOL\nPÁLYA');

  const [loadedFontFamily, setLoadedFontFamily] = useState<string | null>(null);
  const [compiledInfo, setCompiledInfo] = useState<CompiledFontResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeFaceRef = useRef<FontFace | null>(null);
  const buildCounterRef = useRef(0);

  const variantData = useMemo(
    () => deriveWeightVariantParams(params, previewWeight),
    [params, previewWeight]
  );

  const variantOverrides = useMemo(
    () => (previewWeight === 'regular' ? overrides : {}),
    [overrides, previewWeight]
  );

  const { kerningMap, entries } = useMemo(
    () =>
      computeOpticalKerning(
        variantData.params,
        variantOverrides,
        kerningStrength,
        manualKerning
      ),
    [variantData.params, variantOverrides, kerningStrength, manualKerning]
  );

  // Compile REAL .ttf binary and inject via CSS FontFace API!
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const compiled = compileTrueTypeFontBuffer(
          fontName,
          variantData.params,
          variantOverrides,
          kerningMap,
          {
            styleName: variantData.styleName,
            weightClass: variantData.weightClass,
            isBold: variantData.isBold,
          }
        );

        buildCounterRef.current += 1;
        const dynamicName = `AlmaLiveFont_${buildCounterRef.current}`;
        const face = new FontFace(dynamicName, compiled.buffer);
        await face.load();

        if (cancelled) return;

        if (activeFaceRef.current) {
          document.fonts.delete(activeFaceRef.current);
        }
        document.fonts.add(face);
        activeFaceRef.current = face;
        setLoadedFontFamily(dynamicName);
        setCompiledInfo(compiled);
        setLoadError(null);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Nem sikerült betölteni a .ttf binárist'
          );
        }
      }
    }, 110);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fontName, variantData, variantOverrides, kerningMap]);

  useEffect(() => {
    return () => {
      if (activeFaceRef.current) {
        document.fonts.delete(activeFaceRef.current);
      }
    };
  }, []);

  const selectedEntry: KerningPairEntry | null = useMemo(() => {
    return (
      entries.find((e) => e.key === selectedPairKey) ??
      entries[0] ??
      null
    );
  }, [entries, selectedPairKey]);

  const handleSetPairKern = (key: string, val: number) => {
    onManualKerningChange({ ...manualKerning, [key]: val });
  };

  const handleResetPair = (key: string) => {
    const next = { ...manualKerning };
    delete next[key];
    onManualKerningChange(next);
  };

  const handleAddCustomPair = (e: React.FormEvent) => {
    e.preventDefault();
    const chars = [...customPairInput];
    if (chars.length !== 2) return;
    const key = `${chars[0]}${chars[1]}`;
    if (!(key in manualKerning)) {
      const existing = entries.find((item) => item.key === key);
      onManualKerningChange({
        ...manualKerning,
        [key]: existing ? existing.value : -40,
      });
    }
    setSelectedPairKey(key);
    setCustomPairInput('');
  };

  const liveFontStyle: React.CSSProperties = {
    fontFamily: loadedFontFamily ? `"${loadedFontFamily}", sans-serif` : 'sans-serif',
    fontKerning: kerningEnabled ? 'normal' : 'none',
    fontFeatureSettings: kerningEnabled ? '"kern" 1' : '"kern" 0',
  };

  const nonZeroEntries = useMemo(
    () => entries.filter((e) => e.value !== 0 || e.isManual),
    [entries]
  );

  return (
    <section className="test-lab-shell" aria-label="Élő .TTF tesztelő és kerning stúdió">
      {/* Live Binary Status Banner */}
      <div className="binary-status-bar">
        <div className="binary-status-left">
          <CheckCircle2 size={17} className="status-ok-icon" />
          <div>
            <div className="binary-status-title">
              {loadError
                ? `Betöltési hiba: ${loadError}`
                : compiledInfo
                  ? `Valódi .TTF bináris betöltve (@font-face) · ${compiledInfo.styleName}`
                  : 'Bináris .TTF fordítása...'}
            </div>
            {compiledInfo && (
              <div className="binary-status-meta">
                {(compiledInfo.byteLength / 1024).toFixed(1)} KB ·{' '}
                {compiledInfo.glyphCount} glifa ·{' '}
                <strong>{compiledInfo.kerningPairCount} kerning-pár</strong> (GPOS + kern) ·
                OS/2 Weight {compiledInfo.weightClass}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="primary-export-btn compact"
          onClick={onDownloadFamilyZip}
        >
          <Package size={15} />
          3-súlyú család (.zip)
        </button>
      </div>

      {/* Controls Strip: Weight, Kerning A/B, Mockup */}
      <div className="lab-controls-bar">
        <div className="sample-pills" role="group" aria-label="Tesztelt súly">
          {(
            [
              { id: 'regular', label: 'Regular (400)' },
              { id: 'bold', label: 'Bold (700)' },
              { id: 'molten', label: 'Molten (900)' },
            ] as const
          ).map((w) => (
            <button
              key={w.id}
              type="button"
              className={`pill-btn ${previewWeight === w.id ? 'is-active' : ''}`}
              onClick={() => setPreviewWeight(w.id)}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className="sample-pills" role="group" aria-label="Mockup nézet">
          <button
            type="button"
            className={`pill-btn ${mockup === 'slide' ? 'is-active' : ''}`}
            onClick={() => setMockup('slide')}
          >
            Dia előnézet
          </button>
          <button
            type="button"
            className={`pill-btn ${mockup === 'poster' ? 'is-active' : ''}`}
            onClick={() => setMockup('poster')}
          >
            Post-it plakát
          </button>
          <button
            type="button"
            className={`pill-btn ${mockup === 'pairs' ? 'is-active' : ''}`}
            onClick={() => setMockup('pairs')}
          >
            Kerning A/B teszt
          </button>
        </div>

        <button
          type="button"
          className={`kern-toggle-btn ${kerningEnabled ? 'is-on' : ''}`}
          onClick={() => setKerningEnabled((v) => !v)}
          title="Böngésző natív GPOS kerning ki/bekapcsolása összehasonlításhoz"
        >
          <Sparkles size={14} />
          GPOS Kerning: {kerningEnabled ? 'BE' : 'KI'}
        </button>
      </div>

      {/* Real Browser-Rendered @font-face Mockup Stage */}
      <div className="live-ttf-stage">
        {mockup === 'slide' && (
          <div className="mockup-slide">
            <div className="mockup-slide-eyebrow">
              VALÓDI .TTF RENDER · BÖNGÉSZŐ NATÍV OPENTYPE MOTOR
            </div>
            <input
              type="text"
              className="mockup-slide-title"
              style={liveFontStyle}
              value={slideTitle}
              onChange={(e) => setSlideTitle(e.target.value)}
              aria-label="Dia címsor"
            />
            <input
              type="text"
              className="mockup-slide-sub"
              style={liveFontStyle}
              value={slideSubtitle}
              onChange={(e) => setSlideSubtitle(e.target.value)}
              aria-label="Dia alcím"
            />
            <div className="mockup-slide-footer">
              <span>{fontName} · {variantData.styleName}</span>
              <span>Kattints a szövegbe és gépelj élőben a lefordított fontoddal</span>
            </div>
          </div>
        )}

        {mockup === 'poster' && (
          <div className="mockup-poster">
            <textarea
              className="mockup-poster-text"
              style={liveFontStyle}
              value={posterText}
              onChange={(e) => setPosterText(e.target.value)}
              rows={3}
              aria-label="Plakát szöveg"
            />
            <div className="mockup-poster-stamp">
              POST-IT EDITION · {variantData.styleName.toUpperCase()} · GPOS{' '}
              {kerningEnabled ? 'ON' : 'OFF'}
            </div>
          </div>
        )}

        {mockup === 'pairs' && (
          <div className="mockup-ab-compare">
            <div className="ab-row">
              <span className="ab-badge off">Kerning KI (nyers glifa-szélesség)</span>
              <div
                className="ab-sample"
                style={{
                  fontFamily: liveFontStyle.fontFamily,
                  fontKerning: 'none',
                  fontFeatureSettings: '"kern" 0',
                }}
              >
                AVATAR · TÁVOL · WAVE · ALMA · PÁLYA · FÁK · LYUK
              </div>
            </div>
            <div className="ab-row">
              <span className="ab-badge on">
                Kerning BE (optikai GPOS + kern tábla)
              </span>
              <div
                className="ab-sample"
                style={{
                  fontFamily: liveFontStyle.fontFamily,
                  fontKerning: 'normal',
                  fontFeatureSettings: '"kern" 1',
                }}
              >
                AVATAR · TÁVOL · WAVE · ALMA · PÁLYA · FÁK · LYUK
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Optical Kerning Workbench */}
      <div className="kerning-workbench">
        <div className="kerning-left-col">
          <div className="panel-card">
            <div className="panel-card-header">
              <span className="section-eyebrow">
                <SlidersHorizontal size={12} style={{ marginRight: 6 }} />
                Optikai kerning motor
              </span>
              <span className="pieces-counter">
                <strong>{nonZeroEntries.length}</strong> aktív pár
              </span>
            </div>

            <RangeSlider
              label="Optikai kerning erőssége"
              value={kerningStrength}
              min={0}
              max={140}
              unit="%"
              onChange={onKerningStrengthChange}
            />

            <form className="custom-pair-form" onSubmit={handleAddCustomPair}>
              <input
                type="text"
                maxLength={2}
                className="custom-pair-input"
                value={customPairInput}
                onChange={(e) => setCustomPairInput(e.target.value)}
                placeholder="Új pár (pl. ÁL)"
                aria-label="Egyedi 2 betűs kerning-pár hozzáadása"
              />
              <button
                type="submit"
                className="mini-btn accent"
                disabled={[...customPairInput].length !== 2}
              >
                <Plus size={13} />
                Hozzáad
              </button>
              {Object.keys(manualKerning).length > 0 && (
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => onManualKerningChange({})}
                >
                  <RotateCcw size={12} />
                  Kézi reset
                </button>
              )}
            </form>
          </div>

          {selectedEntry && (
            <div className="panel-card selected-pair-card">
              <div className="panel-card-header">
                <span className="section-eyebrow">
                  Kijelölt pár: <strong>„{selectedEntry.key}”</strong>
                </span>
                {selectedEntry.isManual && (
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => handleResetPair(selectedEntry.key)}
                  >
                    <RotateCcw size={12} />
                    Auto ({selectedEntry.autoValue}u)
                  </button>
                )}
              </div>

              <div className="pair-loupe">
                <div className="pair-loupe-col">
                  <span className="pair-loupe-label">Nyers (0u)</span>
                  <div
                    className="pair-loupe-glyphs"
                    style={{
                      fontFamily: liveFontStyle.fontFamily,
                      fontKerning: 'none',
                      fontFeatureSettings: '"kern" 0',
                    }}
                  >
                    {selectedEntry.key}
                  </div>
                </div>
                <div className="pair-loupe-col">
                  <span className="pair-loupe-label accent">
                    Kernelt ({selectedEntry.value > 0 ? `+${selectedEntry.value}` : selectedEntry.value}u)
                  </span>
                  <div
                    className="pair-loupe-glyphs"
                    style={{
                      fontFamily: liveFontStyle.fontFamily,
                      fontKerning: 'normal',
                      fontFeatureSettings: '"kern" 1',
                    }}
                  >
                    {selectedEntry.key}
                  </div>
                </div>
              </div>

              <RangeSlider
                label={`„${selectedEntry.key}” finomhangolás`}
                value={selectedEntry.value}
                min={-220}
                max={100}
                step={5}
                formatValue={(v) => `${v > 0 ? `+${v}` : v}u`}
                onChange={(v) => handleSetPairKern(selectedEntry.key, v)}
              />
            </div>
          )}
        </div>

        <div className="panel-card kerning-pairs-list-card">
          <div className="panel-card-header">
            <span className="section-eyebrow">
              Számított optikai párok (kattints a szerkesztéshez)
            </span>
          </div>
          <div className="kerning-pairs-grid">
            {entries.slice(0, 64).map((entry) => {
              const isSelected = selectedEntry?.key === entry.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  className={`kern-chip ${isSelected ? 'is-selected' : ''} ${entry.isManual ? 'is-manual' : ''}`}
                  onClick={() => setSelectedPairKey(entry.key)}
                >
                  <span className="kern-chip-pair">{entry.key}</span>
                  <span className="kern-chip-val">
                    {entry.value > 0 ? `+${entry.value}` : entry.value}u
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
