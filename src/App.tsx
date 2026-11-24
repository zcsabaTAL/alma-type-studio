import React, { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Gift, PenTool, Type } from 'lucide-react';
import {
  ActiveTab,
  ConstructionParams,
  GlyphData,
  SavedHandwriting,
  SketchAnalysisResult,
  TypesettingParams,
} from './types/font';
import { analyzeSketchImage, mapAnalysisToParams } from './engine/sketchAnalyzer';
import { computeOpticalKerning } from './engine/kerningEngine';
import {
  createCompactThumb,
  loadSavedHandwritings,
  persistSavedHandwritings,
} from './engine/handwritingStore';
import {
  downloadFontFamilyZip,
  downloadSpecimenSvg,
  downloadTrueTypeFont,
} from './engine/fontExporter';
import { StudioCanvas } from './components/StudioCanvas';
import { GlyphsView } from './components/GlyphsView';
import { KerningTestLab } from './components/KerningTestLab';
import { HolidayCardStudio } from './components/HolidayCardStudio';
import { ControlPanel } from './components/ControlPanel';

const DEFAULT_ACTIVE_PIECES = {
  'stem-left': true,
  'stem-right': true,
  'crossbar-rise': true,
  'foot-kick': true,
  'apex-spike': true,
  'diag-plunge': true,
};

const INITIAL_PARAMS: ConstructionParams = {
  pieceVariation: 46,
  exaggeration: 58,
  jointMelt: 22,
  counterPinch: 18,
  limbDrop: 12,
  baselineBounce: 24,
  waistHeight: 46,
  strokeWeight: 36,
  activePieces: { ...DEFAULT_ACTIVE_PIECES },
};

const INITIAL_TYPESETTING: TypesettingParams = {
  fontSize: 124,
  lineHeight: 1.24,
  letterSpacing: 14,
  renderMode: 'solid',
  showMetrics: true,
  canvasTheme: 'dark',
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');
  const [editingChar, setEditingChar] = useState<string | null>(null);
  const [fontName, setFontName] = useState('ALMA Studio');
  const [specimenText, setSpecimenText] = useState(
    'ALMA\nÁrvíztűrő tükörfúrógép\n0123456789'
  );
  const [params, setParams] = useState<ConstructionParams>(INITIAL_PARAMS);
  const [typesetting, setTypesetting] =
    useState<TypesettingParams>(INITIAL_TYPESETTING);
  const [overrides, setOverrides] = useState<Record<string, GlyphData>>({});
  const [kerningStrength, setKerningStrength] = useState<number>(100);
  const [manualKerning, setManualKerning] = useState<Record<string, number>>({});
  const [sketchAnalysis, setSketchAnalysis] =
    useState<SketchAnalysisResult | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [savedHandwritings, setSavedHandwritings] = useState<SavedHandwriting[]>(
    () => loadSavedHandwritings()
  );
  const [activeHandwritingId, setActiveHandwritingId] = useState<string | null>(
    'builtin-alma-postit'
  );

  useEffect(() => {
    persistSavedHandwritings(savedHandwritings);
  }, [savedHandwritings]);

  // Automatically analyze bundled ALMA Post-it sketch on startup
  useEffect(() => {
    let cancelled = false;
    analyzeSketchImage(`${import.meta.env.BASE_URL}alma-sketch.jpg`, 'ALMA Sketch')
      .then((res) => {
        if (!cancelled) setSketchAnalysis(res);
      })
      .catch(() => {
        // Ignore if preview image fails
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { kerningMap } = useMemo(
    () => computeOpticalKerning(params, overrides, kerningStrength, manualKerning),
    [params, overrides, kerningStrength, manualKerning]
  );

  const kerningPairCount = Object.keys(kerningMap).length;

  const handleUploadSketch = async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    try {
      const res = await analyzeSketchImage(objectUrl, file.name);
      setSketchAnalysis(res);
      setParams((prev) => mapAnalysisToParams(res, prev));
      setExportStatus(`Vázlat beolvasva: ${file.name} (dőlés ~${res.estimatedSlantDeg}°)`);
    } catch {
      setExportStatus('Nem sikerült feldolgozni a feltöltött képet.');
    }
  };

  const handleApplySketchDna = () => {
    if (!sketchAnalysis) return;
    setParams((prev) => mapAnalysisToParams(sketchAnalysis, prev));
    setExportStatus('Csúszkák újrakalibrálva a vázlat tinta-elemzése alapján.');
  };

  const handleApplyPreset = (presetId: string) => {
    if (presetId === 'alma-raw') {
      setParams({ ...INITIAL_PARAMS, activePieces: { ...DEFAULT_ACTIVE_PIECES } });
      setTypesetting((t) => ({ ...t, canvasTheme: 'postit' }));
    } else if (presetId === 'molten-hydrogen') {
      setParams({
        pieceVariation: 35,
        exaggeration: 62,
        jointMelt: 82,
        counterPinch: 46,
        limbDrop: 28,
        baselineBounce: 32,
        waistHeight: 44,
        strokeWeight: 54,
        activePieces: { ...DEFAULT_ACTIVE_PIECES },
      });
      setTypesetting((t) => ({ ...t, canvasTheme: 'dark' }));
    } else if (presetId === 'razor-editorial') {
      setParams({
        pieceVariation: 60,
        exaggeration: 84,
        jointMelt: 10,
        counterPinch: 12,
        limbDrop: 36,
        baselineBounce: 18,
        waistHeight: 40,
        strokeWeight: 26,
        activePieces: { ...DEFAULT_ACTIVE_PIECES },
      });
      setTypesetting((t) => ({ ...t, canvasTheme: 'paper' }));
    } else if (presetId === 'poster-heavy') {
      setParams({
        pieceVariation: 28,
        exaggeration: 48,
        jointMelt: 64,
        counterPinch: 62,
        limbDrop: 14,
        baselineBounce: 14,
        waistHeight: 52,
        strokeWeight: 66,
        activePieces: { ...DEFAULT_ACTIVE_PIECES },
      });
      setTypesetting((t) => ({ ...t, canvasTheme: 'dark' }));
    }
  };

  const handleSelectGlyphToEdit = (char: string) => {
    if (char === ' ') return;
    setEditingChar(char);
    setActiveTab('glyphs');
  };

  const handleSaveOverride = (char: string, updated: GlyphData) => {
    setOverrides((prev) => ({ ...prev, [char]: updated }));
  };

  const handleResetOverride = (char: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[char];
      return next;
    });
  };

  const handleDownloadTtf = () => {
    try {
      const result = downloadTrueTypeFont(fontName, params, overrides, kerningMap);
      const kb = (result.byteLength / 1024).toFixed(1);
      setExportStatus(
        `Letöltve: ${result.fileName} (${kb} KB · ${result.glyphCount} glifa · ${result.kerningPairCount} kerning-pár)`
      );
    } catch (err) {
      setExportStatus(
        `Export hiba: ${err instanceof Error ? err.message : 'ismeretlen hiba'}`
      );
    }
  };

  const handleDownloadFamilyZip = () => {
    try {
      const result = downloadFontFamilyZip(
        fontName,
        params,
        overrides,
        kerningStrength,
        manualKerning
      );
      const kb = (result.totalBytes / 1024).toFixed(1);
      setExportStatus(
        `Család letöltve: ${result.zipFileName} (${kb} KB · Regular + Bold + Molten Display · GPOS + kern)`
      );
    } catch (err) {
      setExportStatus(
        `Család export hiba: ${err instanceof Error ? err.message : 'ismeretlen hiba'}`
      );
    }
  };

  const handleSelectHandwriting = (id: string) => {
    const found = savedHandwritings.find((h) => h.id === id);
    if (!found) return;
    setActiveHandwritingId(found.id);
    setFontName(found.name);
    setParams({
      ...found.params,
      activePieces: { ...found.params.activePieces },
    });
    setOverrides(found.overrides ? { ...found.overrides } : {});
    setKerningStrength(found.kerningStrength ?? 100);
    setManualKerning(found.manualKerning ? { ...found.manualKerning } : {});
    setExportStatus(`Betöltve: ${found.name}`);
  };

  const handleSaveNewHandwriting = async (name: string) => {
    const thumb = sketchAnalysis?.imageUrl
      ? await createCompactThumb(sketchAnalysis.imageUrl)
      : undefined;
    const newItem: SavedHandwriting = {
      id: `hw-${Date.now()}`,
      name,
      params: {
        ...params,
        activePieces: { ...params.activePieces },
      },
      overrides: { ...overrides },
      kerningStrength,
      manualKerning: { ...manualKerning },
      sketchThumbUrl: thumb,
      createdAt: Date.now(),
      isBuiltIn: false,
    };
    setSavedHandwritings((prev) => [...prev, newItem]);
    setActiveHandwritingId(newItem.id);
    setFontName(name);
    setExportStatus(
      `Elmentve: „${name}” — mostantól a Grincs Üdvözlőlap minden szövegéhez külön kiválasztható!`
    );
  };

  const handleUpdateActiveHandwriting = async () => {
    if (!activeHandwritingId) return;
    const target = savedHandwritings.find((h) => h.id === activeHandwritingId);
    if (!target || target.isBuiltIn) return;
    const thumb = sketchAnalysis?.imageUrl
      ? await createCompactThumb(sketchAnalysis.imageUrl)
      : target.sketchThumbUrl;
    setSavedHandwritings((prev) =>
      prev.map((h) =>
        h.id === activeHandwritingId
          ? {
              ...h,
              name: fontName.trim() || h.name,
              params: { ...params, activePieces: { ...params.activePieces } },
              overrides: { ...overrides },
              kerningStrength,
              manualKerning: { ...manualKerning },
              sketchThumbUrl: thumb,
            }
          : h
      )
    );
    setExportStatus(`Frissítve: „${target.name}”`);
  };

  const handleDeleteHandwriting = (id: string) => {
    setSavedHandwritings((prev) => prev.filter((h) => h.id !== id));
    if (activeHandwritingId === id) {
      setActiveHandwritingId(null);
    }
    setExportStatus('Kézírás törölve a mentett listából.');
  };

  const handleExportSvg = () => {
    try {
      const fileName = downloadSpecimenSvg(
        specimenText,
        fontName,
        params,
        typesetting,
        overrides,
        kerningMap
      );
      setExportStatus(`Vektoros minta letöltve: ${fileName}`);
    } catch (err) {
      setExportStatus(
        `SVG hiba: ${err instanceof Error ? err.message : 'ismeretlen hiba'}`
      );
    }
  };

  const overrideCount = Object.keys(overrides).length;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            A
          </div>
          <div>
            <h1 className="brand-title">ALMA Type Studio</h1>
            <p className="brand-sub">
              Parametrikus SDF + Bézier betűtípus-készítő · GPOS Kerning + 3-súlyú .TTF család
            </p>
          </div>
        </div>

        <nav className="main-tabs" aria-label="Nézetek">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'studio' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('studio')}
          >
            <Type size={16} />
            Type Studio
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'glyphs' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('glyphs')}
          >
            <PenTool size={16} />
            Glyphs &amp; Bézier
            {overrideCount > 0 && (
              <span className="tab-badge">{overrideCount}</span>
            )}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'test' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('test')}
          >
            <FlaskConical size={16} />
            Test &amp; Kerning
            <span className="tab-badge subtle">{kerningPairCount}</span>
          </button>
          <button
            type="button"
            className={`tab-btn grinch-cta ${activeTab === 'cards' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('cards')}
          >
            <Gift size={16} />
            Grincs Üdvözlőlap
          </button>
        </nav>
      </header>

      <main className="workspace-grid">
        <div className="stage-column">
          {activeTab === 'studio' && (
            <StudioCanvas
              text={specimenText}
              onTextChange={setSpecimenText}
              params={params}
              typesetting={typesetting}
              overrides={overrides}
              kerningMap={kerningMap}
              onSelectGlyphToEdit={handleSelectGlyphToEdit}
              onThemeChange={(theme) =>
                setTypesetting((t) => ({ ...t, canvasTheme: theme }))
              }
            />
          )}

          {activeTab === 'glyphs' && (
            <GlyphsView
              params={params}
              typesetting={typesetting}
              overrides={overrides}
              editingChar={editingChar}
              onSelectChar={setEditingChar}
              onSaveOverride={handleSaveOverride}
              onResetOverride={handleResetOverride}
            />
          )}

          {activeTab === 'test' && (
            <KerningTestLab
              fontName={fontName}
              params={params}
              overrides={overrides}
              kerningStrength={kerningStrength}
              onKerningStrengthChange={setKerningStrength}
              manualKerning={manualKerning}
              onManualKerningChange={setManualKerning}
              onDownloadFamilyZip={handleDownloadFamilyZip}
            />
          )}

          {activeTab === 'cards' && (
            <HolidayCardStudio
              fontName={fontName}
              params={params}
              overrides={overrides}
              kerningStrength={kerningStrength}
              manualKerning={manualKerning}
              savedHandwritings={savedHandwritings}
            />
          )}
        </div>

        <ControlPanel
          fontName={fontName}
          onFontNameChange={setFontName}
          params={params}
          onParamsChange={setParams}
          typesetting={typesetting}
          onTypesettingChange={setTypesetting}
          kerningStrength={kerningStrength}
          onKerningStrengthChange={setKerningStrength}
          kerningPairCount={kerningPairCount}
          sketchAnalysis={sketchAnalysis}
          onUploadSketch={handleUploadSketch}
          onApplySketchDna={handleApplySketchDna}
          onDownloadTtf={handleDownloadTtf}
          onDownloadFamilyZip={handleDownloadFamilyZip}
          onExportSvg={handleExportSvg}
          exportStatus={exportStatus}
          onApplyPreset={handleApplyPreset}
          savedHandwritings={savedHandwritings}
          activeHandwritingId={activeHandwritingId}
          onSelectHandwriting={handleSelectHandwriting}
          onSaveNewHandwriting={handleSaveNewHandwriting}
          onUpdateActiveHandwriting={handleUpdateActiveHandwriting}
          onDeleteHandwriting={handleDeleteHandwriting}
        />
      </main>
    </div>
  );
};
