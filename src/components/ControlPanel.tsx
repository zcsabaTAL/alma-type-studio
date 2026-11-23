import React, { useRef, useState } from 'react';
import {
  Download,
  FileCode2,
  Grid2x2,
  ImagePlus,
  Layers,
  Package,
  ScanEye,
  Sparkles,
} from 'lucide-react';
import {
  ConstructionParams,
  PieceId,
  SketchAnalysisResult,
  TypesettingParams,
} from '../types/font';
import { EXTRACTED_PIECES } from '../engine/glyphBlueprints';
import { RangeSlider } from './RangeSlider';

interface ControlPanelProps {
  fontName: string;
  onFontNameChange: (name: string) => void;
  params: ConstructionParams;
  onParamsChange: (next: ConstructionParams) => void;
  typesetting: TypesettingParams;
  onTypesettingChange: (next: TypesettingParams) => void;
  kerningStrength: number;
  onKerningStrengthChange: (val: number) => void;
  kerningPairCount: number;
  sketchAnalysis: SketchAnalysisResult | null;
  onUploadSketch: (file: File) => void;
  onApplySketchDna: () => void;
  onDownloadTtf: () => void;
  onDownloadFamilyZip: () => void;
  onExportSvg: () => void;
  exportStatus: string | null;
  onApplyPreset: (presetId: string) => void;
}

const PRESETS = [
  { id: 'alma-raw', label: 'ALMA Post-it' },
  { id: 'molten-hydrogen', label: 'Molten Fluid' },
  { id: 'razor-editorial', label: 'Razor Sketch' },
  { id: 'poster-heavy', label: 'Poster Bold' },
];

export const ControlPanel: React.FC<ControlPanelProps> = ({
  fontName,
  onFontNameChange,
  params,
  onParamsChange,
  typesetting,
  onTypesettingChange,
  kerningStrength,
  onKerningStrengthChange,
  kerningPairCount,
  sketchAnalysis,
  onUploadSketch,
  onApplySketchDna,
  onDownloadTtf,
  onDownloadFamilyZip,
  onExportSvg,
  exportStatus,
  onApplyPreset,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showMaskPreview, setShowMaskPreview] = useState(false);

  const activeCount = EXTRACTED_PIECES.filter((p) => params.activePieces[p.id]).length;

  const updateParam = <K extends keyof ConstructionParams>(
    key: K,
    val: ConstructionParams[K]
  ) => {
    onParamsChange({ ...params, [key]: val });
  };

  const togglePiece = (id: PieceId) => {
    onParamsChange({
      ...params,
      activePieces: {
        ...params.activePieces,
        [id]: !params.activePieces[id],
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadSketch(file);
      e.target.value = '';
    }
  };

  return (
    <aside className="control-panel" aria-label="Tipográfiai vezérlőpanel">
      {/* Reference Sketch + Extracted 6 Pieces */}
      <section className="panel-card">
        <div className="panel-card-header">
          <span className="section-eyebrow">Vázlat DNS · Input Sketch</span>
          <span className="pieces-counter">
            Extracted pieces: <strong>{activeCount}/6</strong> active
          </span>
        </div>

        <div className="sketch-preview-row">
          <div className="sketch-thumb-box">
            {sketchAnalysis ? (
              <img
                src={
                  showMaskPreview
                    ? sketchAnalysis.tracePreviewDataUrl
                    : sketchAnalysis.imageUrl
                }
                alt="Forrás kézi vázlat"
                className="sketch-thumb-img"
              />
            ) : (
              <div className="sketch-thumb-placeholder">Betöltés...</div>
            )}
          </div>

          <div className="sketch-meta-col">
            <div className="sketch-filename" title={sketchAnalysis?.fileName}>
              {sketchAnalysis?.fileName ?? 'ALMA (IMG_0531)'}
            </div>
            {sketchAnalysis && (
              <div className="sketch-stats">
                <span>Dőlés: {sketchAnalysis.estimatedSlantDeg}°</span>
                <span>Tinta: {sketchAnalysis.inkCoverage}%</span>
                <span>Sűrűség: {sketchAnalysis.strokeDensity}%</span>
              </div>
            )}
            <div className="sketch-actions">
              <button
                type="button"
                className="mini-btn"
                onClick={() => setShowMaskPreview((v) => !v)}
                title="Fotó / kinyert tinta-maszk nézet váltása"
              >
                <ScanEye size={13} />
                {showMaskPreview ? 'Fotó' : 'Tinta maszk'}
              </button>
              <button
                type="button"
                className="mini-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={13} />
                Új rajz
              </button>
              <button
                type="button"
                className="mini-btn accent"
                onClick={onApplySketchDna}
                title="Csúszkák kalibrálása a feltöltött rajz méréseiből"
              >
                <Sparkles size={13} />
                Kalibrál
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="pieces-grid" role="group" aria-label="Kinyert alapformák">
          {EXTRACTED_PIECES.map((piece) => {
            const active = params.activePieces[piece.id];
            return (
              <button
                key={piece.id}
                type="button"
                className={`piece-chip ${active ? 'is-active' : ''}`}
                onClick={() => togglePiece(piece.id)}
                title={`${piece.sourceRef} — ${piece.description}`}
              >
                <svg viewBox="0 0 64 64" className="piece-svg" aria-hidden="true">
                  <path d={piece.previewPath} fill="currentColor" />
                </svg>
                <span className="piece-name">{piece.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Presets */}
      <section className="panel-card">
        <div className="panel-card-header">
          <span className="section-eyebrow">Gyors stílus presetek</span>
        </div>
        <div className="preset-grid">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="preset-btn"
              onClick={() => onApplyPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Construction Sliders */}
      <section className="panel-card">
        <div className="panel-card-header">
          <span className="section-eyebrow">Konstrukciós paraméterek</span>
        </div>
        <div className="sliders-stack">
          <RangeSlider
            label="Piece variation"
            value={params.pieceVariation}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => updateParam('pieceVariation', v)}
          />
          <RangeSlider
            label="Exaggeration"
            value={params.exaggeration}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => updateParam('exaggeration', v)}
          />
          <RangeSlider
            label="Joint melt"
            value={params.jointMelt}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => updateParam('jointMelt', v)}
          />
          <RangeSlider
            label="Counter pinch"
            value={params.counterPinch}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => updateParam('counterPinch', v)}
          />
          <RangeSlider
            label="Limb drop"
            value={params.limbDrop}
            min={-40}
            max={100}
            unit="%"
            onChange={(v) => updateParam('limbDrop', v)}
          />
          <RangeSlider
            label="Baseline bounce"
            value={params.baselineBounce}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => updateParam('baselineBounce', v)}
          />
          <RangeSlider
            label="Waist height"
            value={params.waistHeight}
            min={20}
            max={80}
            unit="%"
            onChange={(v) => updateParam('waistHeight', v)}
          />
          <RangeSlider
            label="Stroke weight"
            value={params.strokeWeight}
            min={20}
            max={74}
            unit="u"
            onChange={(v) => updateParam('strokeWeight', v)}
          />
        </div>
      </section>

      {/* Display & Typesetting */}
      <section className="panel-card">
        <div className="panel-card-header">
          <span className="section-eyebrow">Megjelenítés és szedés</span>
          <span className="pieces-counter">
            Kerning: <strong>{kerningPairCount}</strong> pár
          </span>
        </div>

        <div className="mode-toggle-row">
          <button
            type="button"
            className={`seg-btn ${typesetting.renderMode === 'solid' ? 'is-active' : ''}`}
            onClick={() =>
              onTypesettingChange({ ...typesetting, renderMode: 'solid' })
            }
          >
            <Layers size={14} />
            Solid fill
          </button>
          <button
            type="button"
            className={`seg-btn ${typesetting.renderMode === 'outline' ? 'is-active' : ''}`}
            onClick={() =>
              onTypesettingChange({ ...typesetting, renderMode: 'outline' })
            }
          >
            <Grid2x2 size={14} />
            Outline
          </button>
        </div>

        <div className="sliders-stack">
          <RangeSlider
            label="Optikai kerning"
            value={kerningStrength}
            min={0}
            max={140}
            unit="%"
            onChange={onKerningStrengthChange}
          />
          <RangeSlider
            label="Betűméret"
            value={typesetting.fontSize}
            min={44}
            max={220}
            unit="px"
            onChange={(v) =>
              onTypesettingChange({ ...typesetting, fontSize: v })
            }
          />
          <RangeSlider
            label="Sorköz"
            value={Math.round(typesetting.lineHeight * 100)}
            min={85}
            max={190}
            formatValue={(v) => `${(v / 100).toFixed(2)}×`}
            onChange={(v) =>
              onTypesettingChange({ ...typesetting, lineHeight: v / 100 })
            }
          />
          <RangeSlider
            label="Betűköz"
            value={typesetting.letterSpacing}
            min={-40}
            max={120}
            unit="u"
            onChange={(v) =>
              onTypesettingChange({ ...typesetting, letterSpacing: v })
            }
          />
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={typesetting.showMetrics}
            onChange={(e) =>
              onTypesettingChange({
                ...typesetting,
                showMetrics: e.target.checked,
              })
            }
          />
          <span>Tipográfiai segédvonalak (Cap / Waist / Base)</span>
        </label>
      </section>

      {/* Export */}
      <section className="panel-card export-card">
        <div className="panel-card-header">
          <span className="section-eyebrow">Valódi .TTF · Család · .SVG Export</span>
        </div>

        <label className="font-name-label" htmlFor="font-family-name">
          Betűtípus család neve
        </label>
        <input
          id="font-family-name"
          type="text"
          className="font-name-input"
          value={fontName}
          onChange={(e) => onFontNameChange(e.target.value)}
          placeholder="ALMA Studio"
        />

        <div className="export-buttons">
          <button
            type="button"
            className="primary-export-btn"
            onClick={onDownloadTtf}
          >
            <Download size={16} />
            Download .ttf
          </button>
          <button
            type="button"
            className="secondary-export-btn"
            onClick={onExportSvg}
          >
            <FileCode2 size={16} />
            Export .svg
          </button>
        </div>

        <button
          type="button"
          className="family-export-btn"
          onClick={onDownloadFamilyZip}
          title="Regular (400) + Bold (700) + Molten Display (900) egyetlen .zip csomagban"
        >
          <Package size={15} />
          Download Family (.zip) · 3 súly + GPOS
        </button>

        {exportStatus && (
          <div className="export-status" role="status" aria-live="polite">
            {exportStatus}
          </div>
        )}
      </section>
    </aside>
  );
};
