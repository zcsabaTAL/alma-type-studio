import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  CopyPlus,
  Download,
  FileCode2,
  Gift,
  ImagePlus,
  Move,
  Palette,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Trees,
} from 'lucide-react';
import {
  ConstructionParams,
  FontFamilyWeight,
  GlyphData,
} from '../types/font';
import { GLYPH_BLUEPRINTS } from '../engine/glyphBlueprints';
import {
  ASCENDER,
  UPM,
  generateProceduralGlyph,
  glyphToSvgPath,
} from '../engine/sdfVectorizer';
import { computeOpticalKerning } from '../engine/kerningEngine';
import { deriveWeightVariantParams } from '../engine/fontExporter';
import { RangeSlider } from './RangeSlider';
import {
  FESTIVE_SWATCHES,
  STICKER_CATALOG,
  STICKER_META_MAP,
  StickerGraphic,
  StickerInstance,
  StickerKind,
} from './HolidayStickers';

interface HolidayCardStudioProps {
  fontName: string;
  params: ConstructionParams;
  overrides: Record<string, GlyphData>;
  kerningStrength: number;
  manualKerning: Record<string, number>;
}

type CardThemeId =
  | 'grinch-fur'
  | 'bejgli-chaos'
  | 'postit-office'
  | 'midnight-frost'
  | 'ginger-gold';

type CardFormatId = 'postcard' | 'story' | 'square';
type PhotoFrameMode = 'polaroid' | 'rounded' | 'circle' | 'background';
type CoreLayerId = 'photo' | 'headline' | 'subline' | 'signature';

type SelectionTarget =
  | { type: 'core'; id: CoreLayerId }
  | { type: 'sticker'; id: string };

interface LayerTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

interface CoreColorOverride {
  primary?: string;
  secondary?: string;
}

type DragInteraction =
  | {
      kind: 'move';
      target: SelectionTarget;
      startPtrX: number;
      startPtrY: number;
      origX: number;
      origY: number;
    }
  | {
      kind: 'scale';
      target: SelectionTarget;
      centerX: number;
      centerY: number;
      startDist: number;
      origScale: number;
    }
  | {
      kind: 'rotate';
      target: SelectionTarget;
      centerX: number;
      centerY: number;
      startAngle: number;
      origRotation: number;
    };

interface CardTheme {
  id: CardThemeId;
  label: string;
  bgStart: string;
  bgEnd: string;
  frameColor: string;
  headlineColor: string;
  headlineAltColor: string;
  shadowColor: string;
  subColor: string;
  badgeBg: string;
  badgeText: string;
  decorAccent: string;
  decorSecondary: string;
}

const CORE_LAYER_LABELS: Record<CoreLayerId, string> = {
  photo: 'Feltöltött fotó',
  headline: 'Főcím',
  subline: 'Alcím / Poén',
  signature: 'Aláírás',
};

const CARD_THEMES: CardTheme[] = [
  {
    id: 'grinch-fur',
    label: 'Grincs Zöld',
    bgStart: '#183d1e',
    bgEnd: '#2e6b27',
    frameColor: 'rgba(182, 245, 92, 0.35)',
    headlineColor: '#c8ff59',
    headlineAltColor: '#ff5247',
    shadowColor: '#0c2110',
    subColor: '#f3f7e8',
    badgeBg: '#d92d27',
    badgeText: '#fff8ec',
    decorAccent: '#ff483b',
    decorSecondary: '#ffe14d',
  },
  {
    id: 'bejgli-chaos',
    label: 'Bejgli & Bordó',
    bgStart: '#491019',
    bgEnd: '#6e1925',
    frameColor: 'rgba(244, 206, 122, 0.38)',
    headlineColor: '#f8e5b8',
    headlineAltColor: '#f3be5c',
    shadowColor: '#26060b',
    subColor: '#f5dede',
    badgeBg: '#e2a93b',
    badgeText: '#2b090e',
    decorAccent: '#f2c15a',
    decorSecondary: '#79c97b',
  },
  {
    id: 'postit-office',
    label: 'Post-it Irodai Grincs',
    bgStart: '#ee624a',
    bgEnd: '#e04f38',
    frameColor: 'rgba(24, 26, 42, 0.25)',
    headlineColor: '#161826',
    headlineAltColor: '#fff5e6',
    shadowColor: 'rgba(24, 26, 42, 0.22)',
    subColor: '#1e2134',
    badgeBg: '#161826',
    badgeText: '#fff5e6',
    decorAccent: '#161826',
    decorSecondary: '#c8ff59',
  },
  {
    id: 'midnight-frost',
    label: 'Fagyos Éjfél',
    bgStart: '#0b1824',
    bgEnd: '#142c40',
    frameColor: 'rgba(165, 224, 255, 0.3)',
    headlineColor: '#e8f7ff',
    headlineAltColor: '#ff6e54',
    shadowColor: '#050c12',
    subColor: '#b5d6ea',
    badgeBg: '#ff6e54',
    badgeText: '#0b1824',
    decorAccent: '#8ce3ff',
    decorSecondary: '#ff6e54',
  },
  {
    id: 'ginger-gold',
    label: 'Mézeskalács & Arany',
    bgStart: '#3a2214',
    bgEnd: '#52301b',
    frameColor: 'rgba(245, 204, 125, 0.42)',
    headlineColor: '#f5cb78',
    headlineAltColor: '#fff5e4',
    shadowColor: '#1e1008',
    subColor: '#ecd5b5',
    badgeBg: '#f5cb78',
    badgeText: '#2c170b',
    decorAccent: '#fff2d6',
    decorSecondary: '#d9483b',
  },
];

const CARD_FORMATS: Record<
  CardFormatId,
  { label: string; width: number; height: number }
> = {
  postcard: { label: 'Képeslap (3:2)', width: 1200, height: 800 },
  story: { label: 'Messenger / Insta (4:5)', width: 960, height: 1200 },
  square: { label: 'Négyzet (1:1)', width: 1080, height: 1080 },
};

const MESSAGE_PRESETS = [
  {
    label: 'Grincs klasszikus',
    headline: 'BOLDOG KARÁCSONYT!\n(DE CSAK MERT MUSZÁJ)',
    subline: 'Sok bejglit, nulla drámát!',
    signature: 'Üdv: Zoli & a Grincs-kommandó',
    theme: 'grinch-fur' as CardThemeId,
  },
  {
    label: 'Irodai / Meeting Grincs',
    headline: 'KEVESEBB MEETING,\nTÖBB BEJGLI!',
    subline: 'Az idei utolsó sprint: pihenés',
    signature: 'Kellemes ünnepeket · Zoli',
    theme: 'bejgli-chaos' as CardThemeId,
  },
  {
    label: 'Out of Office Post-it',
    headline: 'OUT OF OFFICE!\nJANUÁRIG NE KERESS',
    subline: 'Kivéve ha forralt bort hozol',
    signature: 'Boldog Karácsonyt · Zoli',
    theme: 'postit-office' as CardThemeId,
  },
  {
    label: 'Diéta januárban',
    headline: 'KELLEMES ÜNNEPEKET!\nA DIÉTA MAJD JANUÁRBAN',
    subline: 'Addig is jöhet a mézeskalács',
    signature: 'Sok szeretettel · Zoliék',
    theme: 'midnight-frost' as CardThemeId,
  },
  {
    label: 'Szívből, klasszikus',
    headline: 'BÉKÉS, BOLDOG\nKARÁCSONYT!',
    subline: 'Örömökben gazdag új évet',
    signature: 'Szeretettel: A Csapat',
    theme: 'ginger-gold' as CardThemeId,
  },
];

function createDefaultCoreTransforms(
  formatId: CardFormatId,
  hasPhoto: boolean
): Record<CoreLayerId, LayerTransform> {
  const { width: w, height: h } = CARD_FORMATS[formatId];
  if (formatId === 'story') {
    return {
      photo: { x: w * 0.5, y: h * 0.31, scale: 1.0, rotation: -3 },
      headline: { x: w * 0.5, y: hasPhoto ? h * 0.65 : h * 0.45, scale: 1.0, rotation: 0 },
      subline: { x: w * 0.5, y: hasPhoto ? h * 0.8 : h * 0.65, scale: 1.0, rotation: 0 },
      signature: { x: w * 0.5, y: h - 102, scale: 1.0, rotation: 0 },
    };
  }
  if (formatId === 'square') {
    return {
      photo: { x: w * 0.5, y: h * 0.29, scale: 0.92, rotation: -3 },
      headline: { x: w * 0.5, y: hasPhoto ? h * 0.65 : h * 0.45, scale: 1.0, rotation: 0 },
      subline: { x: w * 0.5, y: hasPhoto ? h * 0.8 : h * 0.66, scale: 1.0, rotation: 0 },
      signature: { x: w * 0.5, y: h - 98, scale: 1.0, rotation: 0 },
    };
  }
  return {
    photo: { x: w * 0.24, y: h * 0.48, scale: 0.96, rotation: -4 },
    headline: { x: hasPhoto ? w * 0.68 : w * 0.5, y: h * 0.43, scale: hasPhoto ? 0.72 : 1.0, rotation: 0 },
    subline: { x: hasPhoto ? w * 0.68 : w * 0.5, y: h * 0.66, scale: hasPhoto ? 0.84 : 1.0, rotation: 0 },
    signature: { x: hasPhoto ? w * 0.68 : w * 0.5, y: h - 102, scale: hasPhoto ? 0.88 : 1.0, rotation: 0 },
  };
}

function createDefaultStickers(
  formatId: CardFormatId,
  theme: CardTheme,
  hasPhoto: boolean
): StickerInstance[] {
  const { width: w, height: h } = CARD_FORMATS[formatId];
  return [
    {
      id: 'st-eyes-init',
      kind: 'grinch-eyes',
      x: hasPhoto && formatId === 'postcard' ? w * 0.68 : w * 0.5,
      y: formatId === 'story' ? (hasPhoto ? h * 0.1 : h * 0.21) : h * 0.17,
      scale: 0.96,
      rotation: 0,
      color: theme.headlineColor,
      accentColor: '#ffe84d',
    },
    {
      id: 'st-hat-init',
      kind: 'santa-hat',
      x: hasPhoto && formatId === 'postcard' ? w * 0.16 : w * 0.19,
      y: hasPhoto && formatId === 'postcard' ? h * 0.19 : h * 0.26,
      scale: 1.0,
      rotation: -18,
      color: '#e02e26',
      accentColor: '#fff8ee',
    },
    {
      id: 'st-orn-init',
      kind: 'ornaments',
      x: w - 128,
      y: 112,
      scale: 0.95,
      rotation: 0,
      color: theme.decorAccent,
      accentColor: theme.decorSecondary,
    },
  ];
}

function hashSigned(seed: number): number {
  const x = Math.sin(seed * 91.7 + 17.3) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

interface PositionedLine {
  y: number;
  totalWidth: number;
  glyphs: {
    key: string;
    x: number;
    yOffset: number;
    rotDeg: number;
    d: string;
    altColor: boolean;
  }[];
}

async function fileToInlineDataUrl(file: File): Promise<{
  dataUrl: string;
  aspect: number;
  name: string;
}> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Fájl olvasási hiba'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Kép dekódolási hiba'));
    el.src = rawUrl;
  });

  const maxDim = 1400;
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(64, Math.round(img.width * ratio));
  const h = Math.max(64, Math.round(img.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: rawUrl, aspect: img.width / Math.max(1, img.height), name: file.name };
  }
  ctx.drawImage(img, 0, 0, w, h);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    aspect: w / h,
    name: file.name,
  };
}

interface ColorSwatchPickerProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

const ColorSwatchPicker: React.FC<ColorSwatchPickerProps> = ({
  label,
  value,
  onChange,
}) => {
  return (
    <div className="color-picker-block">
      <div className="color-picker-head">
        <span className="font-name-label">{label}</span>
        <span className="color-hex-code">{value.toUpperCase()}</span>
      </div>
      <div className="swatch-row">
        {FESTIVE_SWATCHES.map((sw) => (
          <button
            key={sw.hex}
            type="button"
            className={`color-dot-btn ${value.toLowerCase() === sw.hex.toLowerCase() ? 'is-selected' : ''}`}
            style={{ backgroundColor: sw.hex }}
            title={sw.label}
            aria-label={`${label}: ${sw.label}`}
            onClick={() => onChange(sw.hex)}
          />
        ))}
        <label className="custom-color-wrap" title="Egyedi szín választása">
          <input
            type="color"
            className="native-color-input"
            value={value.startsWith('#') && value.length === 7 ? value : '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`${label} egyedi szín`}
          />
        </label>
      </div>
    </div>
  );
};

export const HolidayCardStudio: React.FC<HolidayCardStudioProps> = ({
  fontName,
  params,
  overrides,
  kerningStrength,
  manualKerning,
}) => {
  const [themeId, setThemeId] = useState<CardThemeId>('grinch-fur');
  const [formatId, setFormatId] = useState<CardFormatId>('postcard');
  const [weight, setWeight] = useState<FontFamilyWeight>('molten');
  const [headline, setHeadline] = useState(MESSAGE_PRESETS[0].headline);
  const [subline, setSubline] = useState(MESSAGE_PRESETS[0].subline);
  const [signature, setSignature] = useState(MESSAGE_PRESETS[0].signature);
  const [headlineSize, setHeadlineSize] = useState(112);
  const [grinchChaos, setGrinchChaos] = useState(34);
  const [festiveColors, setFestiveColors] = useState(true);
  const [showSnow, setShowSnow] = useState(true);

  // Uploaded Photo state
  const [uploadedPhoto, setUploadedPhoto] = useState<{
    dataUrl: string;
    aspect: number;
    name: string;
  } | null>(null);
  const [photoFrameMode, setPhotoFrameMode] = useState<PhotoFrameMode>('polaroid');
  const [bgScrimOpacity, setBgScrimOpacity] = useState(46);

  // Per-element custom color overrides for core layers + optional custom card background
  const [coreColors, setCoreColors] = useState<Record<CoreLayerId, CoreColorOverride>>({
    photo: {},
    headline: {},
    subline: {},
    signature: {},
  });
  const [customBgColor, setCustomBgColor] = useState<string | null>(null);

  // Interactive Core Transforms + Dynamic Stickers
  const [coreTransforms, setCoreTransforms] = useState<Record<CoreLayerId, LayerTransform>>(
    () => createDefaultCoreTransforms('postcard', false)
  );
  const [stickers, setStickers] = useState<StickerInstance[]>(() =>
    createDefaultStickers('postcard', CARD_THEMES[0], false)
  );
  const [selection, setSelection] = useState<SelectionTarget | null>(null);
  const [dragState, setDragState] = useState<DragInteraction | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const stickerSeqRef = useRef(1);

  const theme = CARD_THEMES.find((t) => t.id === themeId) ?? CARD_THEMES[0];
  const format = CARD_FORMATS[formatId];

  // Resolved colors (user override takes precedence over theme)
  const resolvedHeadlineColor = coreColors.headline.primary ?? theme.headlineColor;
  const resolvedHeadlineAlt = coreColors.headline.secondary ?? theme.headlineAltColor;
  const resolvedSubColor = coreColors.subline.primary ?? theme.subColor;
  const resolvedSigBg = coreColors.signature.primary ?? theme.badgeBg;
  const resolvedSigText = coreColors.signature.secondary ?? theme.badgeText;
  const resolvedPhotoFrame =
    coreColors.photo.primary ??
    (photoFrameMode === 'polaroid' ? '#faf6ee' : theme.headlineColor);

  const variantData = useMemo(
    () => deriveWeightVariantParams(params, weight),
    [params, weight]
  );

  const variantOverrides = useMemo(
    () => (weight === 'regular' ? overrides : {}),
    [overrides, weight]
  );

  const { kerningMap } = useMemo(
    () =>
      computeOpticalKerning(
        variantData.params,
        variantOverrides,
        kerningStrength,
        manualKerning
      ),
    [variantData.params, variantOverrides, kerningStrength, manualKerning]
  );

  const handleSelectTheme = (nextId: CardThemeId) => {
    setThemeId(nextId);
    setCustomBgColor(null);
    setCoreColors({ photo: {}, headline: {}, subline: {}, signature: {} });
  };

  const handleFormatChange = (nextFmt: CardFormatId) => {
    const hasStickerPhoto = !!uploadedPhoto && photoFrameMode !== 'background';
    setFormatId(nextFmt);
    setCoreTransforms(createDefaultCoreTransforms(nextFmt, hasStickerPhoto));
    setStickers(createDefaultStickers(nextFmt, theme, hasStickerPhoto));
    setSelection(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const parsed = await fileToInlineDataUrl(file);
      const wasEmpty = !uploadedPhoto;
      setUploadedPhoto(parsed);
      if (wasEmpty && photoFrameMode !== 'background') {
        setCoreTransforms(createDefaultCoreTransforms(formatId, true));
      }
      setSelection({ type: 'core', id: 'photo' });
      setStatusMsg(
        `Fotó hozzáadva: ${parsed.name}. Bármelyik elemet mozgathatod, átméretezheted és átszínezheted!`
      );
    } catch (err) {
      setStatusMsg(
        `Fotó hiba: ${err instanceof Error ? err.message : 'nem támogatott képformátum'}`
      );
    }
  };

  const handleRemovePhoto = () => {
    setUploadedPhoto(null);
    if (selection?.type === 'core' && selection.id === 'photo') {
      setSelection(null);
    }
    setCoreTransforms(createDefaultCoreTransforms(formatId, false));
  };

  const handlePhotoModeChange = (mode: PhotoFrameMode) => {
    setPhotoFrameMode(mode);
    if (mode === 'background') {
      setCoreTransforms({
        ...createDefaultCoreTransforms(formatId, false),
        photo: { x: format.width * 0.5, y: format.height * 0.5, scale: 1.0, rotation: 0 },
      });
    } else if (uploadedPhoto) {
      setCoreTransforms(createDefaultCoreTransforms(formatId, true));
    }
  };

  const handleAddSticker = (kind: StickerKind) => {
    const meta = STICKER_META_MAP[kind];
    const seq = stickerSeqRef.current++;
    const jitterX = ((seq * 47) % 180) - 90;
    const jitterY = ((seq * 31) % 140) - 70;
    const newSticker: StickerInstance = {
      id: `st-${kind}-${seq}`,
      kind,
      x: Math.round(format.width * 0.5 + jitterX),
      y: Math.round(format.height * 0.42 + jitterY),
      scale: 1.0,
      rotation: kind === 'santa-hat' ? -14 : 0,
      color: meta.defaultColor,
      accentColor: meta.defaultAccent,
    };
    setStickers((prev) => [...prev, newSticker]);
    setSelection({ type: 'sticker', id: newSticker.id });
    setStatusMsg(`Hozzáadva: ${meta.label}. Húzd a helyére, méretezd vagy színezd át!`);
  };

  const handleDuplicateSelectedSticker = () => {
    if (selection?.type !== 'sticker') return;
    const src = stickers.find((s) => s.id === selection.id);
    if (!src) return;
    const seq = stickerSeqRef.current++;
    const copy: StickerInstance = {
      ...src,
      id: `st-${src.kind}-${seq}`,
      x: Math.min(format.width - 60, src.x + 48),
      y: Math.min(format.height - 60, src.y + 36),
    };
    setStickers((prev) => [...prev, copy]);
    setSelection({ type: 'sticker', id: copy.id });
  };

  const handleDeleteSelectedSticker = useCallback(() => {
    if (selection?.type !== 'sticker') return;
    const idToRemove = selection.id;
    setStickers((prev) => prev.filter((s) => s.id !== idToRemove));
    setSelection(null);
  }, [selection]);

  const handleReorderSticker = (direction: 'up' | 'down') => {
    if (selection?.type !== 'sticker') return;
    setStickers((prev) => {
      const idx = prev.findIndex((s) => s.id === selection.id);
      if (idx < 0) return prev;
      const nextIdx = direction === 'up' ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  };

  // Delete selected sticker with Delete / Backspace key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selection?.type === 'sticker'
      ) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        handleDeleteSelectedSticker();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDeleteSelectedSticker, selection]);

  const layoutCenteredBlock = useMemo(() => {
    return (
      text: string,
      fontSize: number,
      lineHeightMult: number,
      chaosAmount: number,
      allowAltColors: boolean
    ): {
      lines: PositionedLine[];
      totalHeight: number;
      maxLineWidth: number;
      boxW: number;
      boxH: number;
    } => {
      const rawLines = text.split('\n');
      const scale = fontSize / UPM;
      const lineAdv = fontSize * lineHeightMult;
      let maxW = 0;

      const lines: PositionedLine[] = rawLines.map((line, lIdx) => {
        const chars = [...line].map((ch) =>
          ch in GLYPH_BLUEPRINTS
            ? ch
            : ch.toUpperCase() in GLYPH_BLUEPRINTS
              ? ch.toUpperCase()
              : ' '
        );

        let cursorX = 0;
        const glyphs: PositionedLine['glyphs'] = [];

        chars.forEach((ch, cIdx) => {
          const glyph =
            variantOverrides[ch] ?? generateProceduralGlyph(ch, variantData.params);
          const d =
            glyph.contours.length > 0 ? glyphToSvgPath(glyph.contours, ASCENDER) : '';
          const seed = (lIdx + 1) * 131 + (cIdx + 1) * 29 + (ch.codePointAt(0) ?? 65);
          const rotDeg = hashSigned(seed) * (chaosAmount / 100) * 7.5;
          const yOffset = hashSigned(seed + 53) * (chaosAmount / 100) * (fontSize * 0.08);
          const altColor =
            allowAltColors && (lIdx % 2 === 1 || ch === '!' || (cIdx % 5 === 0 && ch !== ' '));

          if (d) {
            glyphs.push({
              key: `${lIdx}-${cIdx}-${ch}`,
              x: cursorX,
              yOffset,
              rotDeg,
              d,
              altColor,
            });
          }

          const nextCh = chars[cIdx + 1];
          const kern = nextCh ? kerningMap[`${ch}${nextCh}`] ?? 0 : 0;
          cursorX += (glyph.advanceWidth + kern + 10) * scale;
        });

        if (cursorX > maxW) maxW = cursorX;
        return {
          y: lIdx * lineAdv,
          totalWidth: cursorX,
          glyphs,
        };
      });

      const totalHeight = Math.max(fontSize, rawLines.length * lineAdv);
      return {
        lines,
        totalHeight,
        maxLineWidth: maxW,
        boxW: Math.max(120, maxW + 32),
        boxH: Math.max(70, totalHeight + 24),
      };
    };
  }, [kerningMap, variantData.params, variantOverrides]);

  const safeMaxW = format.width - 170;
  const rawHeadline = useMemo(
    () => layoutCenteredBlock(headline, headlineSize, 1.14, grinchChaos, festiveColors),
    [layoutCenteredBlock, headline, headlineSize, grinchChaos, festiveColors]
  );
  const headlineFit =
    rawHeadline.maxLineWidth > safeMaxW && rawHeadline.maxLineWidth > 0
      ? safeMaxW / rawHeadline.maxLineWidth
      : 1;
  const headlineScale = (headlineSize * headlineFit) / UPM;
  const headlineBox = {
    w: rawHeadline.boxW * headlineFit,
    h: rawHeadline.boxH * headlineFit,
  };

  const subSize = Math.round(format.width * 0.044);
  const rawSub = useMemo(
    () => layoutCenteredBlock(subline, subSize, 1.18, grinchChaos * 0.35, false),
    [layoutCenteredBlock, subline, subSize, grinchChaos]
  );
  const subFit =
    rawSub.maxLineWidth > safeMaxW && rawSub.maxLineWidth > 0
      ? safeMaxW / rawSub.maxLineWidth
      : 1;
  const subScale = (subSize * subFit) / UPM;
  const subBox = {
    w: rawSub.boxW * subFit,
    h: rawSub.boxH * subFit,
  };

  const sigSize = Math.round(format.width * 0.036);
  const rawSig = useMemo(
    () => layoutCenteredBlock(signature, sigSize, 1.15, grinchChaos * 0.25, false),
    [layoutCenteredBlock, signature, sigSize, grinchChaos]
  );
  const sigFit =
    rawSig.maxLineWidth > safeMaxW && rawSig.maxLineWidth > 0
      ? safeMaxW / rawSig.maxLineWidth
      : 1;
  const sigScale = (sigSize * sigFit) / UPM;
  const sigPillW = Math.min(safeMaxW + 48, rawSig.maxLineWidth * sigFit + 76);
  const sigPillH = sigSize * sigFit * 1.48 + 20;

  const photoBox = useMemo(() => {
    if (!uploadedPhoto) return { w: 360, h: 420, imgW: 320, imgH: 320 };
    if (photoFrameMode === 'background') {
      const coverScale = Math.max(
        format.width / (uploadedPhoto.aspect * 1000),
        format.height / 1000
      );
      const w = uploadedPhoto.aspect * 1000 * coverScale;
      const h = 1000 * coverScale;
      return { w, h, imgW: w, imgH: h };
    }
    if (photoFrameMode === 'circle') {
      return { w: 340, h: 340, imgW: 324, imgH: 324 };
    }
    if (photoFrameMode === 'polaroid') {
      const imgW = 328;
      const imgH = Math.max(220, Math.min(390, Math.round(imgW / uploadedPhoto.aspect)));
      return { w: imgW + 36, h: imgH + 92, imgW, imgH };
    }
    const imgW = 360;
    const imgH = Math.max(220, Math.min(440, Math.round(imgW / uploadedPhoto.aspect)));
    return { w: imgW + 16, h: imgH + 16, imgW, imgH };
  }, [format.height, format.width, photoFrameMode, uploadedPhoto]);

  const getTargetTransform = (target: SelectionTarget): LayerTransform | null => {
    if (target.type === 'core') {
      return coreTransforms[target.id];
    }
    const st = stickers.find((s) => s.id === target.id);
    return st ? { x: st.x, y: st.y, scale: st.scale, rotation: st.rotation } : null;
  };

  const getTargetHalfSize = (target: SelectionTarget): { hw: number; hh: number } => {
    if (target.type === 'sticker') {
      const st = stickers.find((s) => s.id === target.id);
      if (!st) return { hw: 60, hh: 60 };
      const meta = STICKER_META_MAP[st.kind];
      return { hw: meta.halfW, hh: meta.halfH };
    }
    switch (target.id) {
      case 'photo':
        return { hw: photoBox.w * 0.5, hh: photoBox.h * 0.5 };
      case 'headline':
        return { hw: headlineBox.w * 0.5, hh: headlineBox.h * 0.5 };
      case 'subline':
        return { hw: subBox.w * 0.5, hh: subBox.h * 0.5 };
      case 'signature':
        return { hw: sigPillW * 0.5, hh: sigPillH * 0.5 };
    }
  };

  const patchTargetTransform = useCallback(
    (target: SelectionTarget, patch: Partial<LayerTransform>) => {
      if (target.type === 'core') {
        setCoreTransforms((prev) => ({
          ...prev,
          [target.id]: { ...prev[target.id], ...patch },
        }));
      } else {
        setStickers((prev) =>
          prev.map((s) => (s.id === target.id ? { ...s, ...patch } : s))
        );
      }
    },
    []
  );

  const clientToCardCoords = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const scale = Math.min(rect.width / format.width, rect.height / format.height);
      const renderedW = format.width * scale;
      const renderedH = format.height * scale;
      const offX = rect.left + (rect.width - renderedW) * 0.5;
      const offY = rect.top + (rect.height - renderedH) * 0.5;
      return [(clientX - offX) / scale, (clientY - offY) / scale];
    },
    [format.height, format.width]
  );

  const startMove = (e: React.PointerEvent, target: SelectionTarget) => {
    e.stopPropagation();
    const pt = clientToCardCoords(e.clientX, e.clientY);
    const cur = getTargetTransform(target);
    if (!pt || !cur) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setSelection(target);
    setDragState({
      kind: 'move',
      target,
      startPtrX: pt[0],
      startPtrY: pt[1],
      origX: cur.x,
      origY: cur.y,
    });
  };

  const startScale = (e: React.PointerEvent, target: SelectionTarget) => {
    e.stopPropagation();
    const pt = clientToCardCoords(e.clientX, e.clientY);
    const cur = getTargetTransform(target);
    if (!pt || !cur) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const startDist = Math.max(12, Math.hypot(pt[0] - cur.x, pt[1] - cur.y));
    setDragState({
      kind: 'scale',
      target,
      centerX: cur.x,
      centerY: cur.y,
      startDist,
      origScale: cur.scale,
    });
  };

  const startRotate = (e: React.PointerEvent, target: SelectionTarget) => {
    e.stopPropagation();
    const pt = clientToCardCoords(e.clientX, e.clientY);
    const cur = getTargetTransform(target);
    if (!pt || !cur) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const startAngle = Math.atan2(pt[1] - cur.y, pt[0] - cur.x);
    setDragState({
      kind: 'rotate',
      target,
      centerX: cur.x,
      centerY: cur.y,
      startAngle,
      origRotation: cur.rotation,
    });
  };

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragState) return;
      const pt = clientToCardCoords(e.clientX, e.clientY);
      if (!pt) return;

      if (dragState.kind === 'move') {
        patchTargetTransform(dragState.target, {
          x: Math.round(dragState.origX + (pt[0] - dragState.startPtrX)),
          y: Math.round(dragState.origY + (pt[1] - dragState.startPtrY)),
        });
      } else if (dragState.kind === 'scale') {
        const dist = Math.hypot(pt[0] - dragState.centerX, pt[1] - dragState.centerY);
        const nextScale = Math.max(
          0.25,
          Math.min(3.0, dragState.origScale * (dist / dragState.startDist))
        );
        patchTargetTransform(dragState.target, {
          scale: Math.round(nextScale * 100) / 100,
        });
      } else {
        const angle = Math.atan2(pt[1] - dragState.centerY, pt[0] - dragState.centerX);
        const deltaDeg = ((angle - dragState.startAngle) * 180) / Math.PI;
        let nextRot = Math.round(dragState.origRotation + deltaDeg);
        if (Math.abs(nextRot) <= 3) nextRot = 0;
        patchTargetTransform(dragState.target, {
          rotation: Math.max(-180, Math.min(180, nextRot)),
        });
      }
    },
    [clientToCardCoords, dragState, patchTargetTransform]
  );

  const handleSvgPointerUp = useCallback(() => {
    setDragState(null);
  }, []);

  const resetAllLayouts = () => {
    const hasStickerPhoto = !!uploadedPhoto && photoFrameMode !== 'background';
    setCoreTransforms(createDefaultCoreTransforms(formatId, hasStickerPhoto));
    setStickers(createDefaultStickers(formatId, theme, hasStickerPhoto));
    setCoreColors({ photo: {}, headline: {}, subline: {}, signature: {} });
    setCustomBgColor(null);
    setSelection(null);
    setStatusMsg('Elrendezés, matricák és színek visszaállítva alapállapotra.');
  };

  const snowflakes = useMemo(() => {
    const arr: { cx: number; cy: number; r: number; op: number }[] = [];
    for (let i = 0; i < 38; i++) {
      const rx = (hashSigned(i * 19.3 + 7) + 1) * 0.5;
      const ry = (hashSigned(i * 37.1 + 11) + 1) * 0.5;
      const r = 2.2 + ((hashSigned(i * 53.7) + 1) * 0.5) * 4.5;
      const op = 0.16 + ((hashSigned(i * 71.9) + 1) * 0.5) * 0.42;
      arr.push({
        cx: Math.round(35 + rx * (format.width - 70)),
        cy: Math.round(35 + ry * (format.height - 70)),
        r: Math.round(r * 10) / 10,
        op: Math.round(op * 100) / 100,
      });
    }
    return arr;
  }, [format.height, format.width]);

  const applyMessagePreset = (preset: (typeof MESSAGE_PRESETS)[number]) => {
    setHeadline(preset.headline);
    setSubline(preset.subline);
    setSignature(preset.signature);
    handleSelectTheme(preset.theme);
  };

  const getCleanExportSvg = (): string | null => {
    const svgEl = svgRef.current;
    if (!svgEl) return null;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('[data-editor-only="true"]').forEach((node) => node.remove());
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    clone.setAttribute('width', String(format.width));
    clone.setAttribute('height', String(format.height));
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  };

  const handleDownloadSvg = () => {
    const xml = getCleanExportSvg();
    if (!xml) return;
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ALMA-Grincs-Kartya-${themeId}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatusMsg('Nyomdakész vektoros .SVG képeslap letöltve!');
  };

  const handleDownloadPng = async () => {
    const xml = getCleanExportSvg();
    if (!xml) return;
    try {
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
        img.src = url;
      });

      const scaleFactor = 2;
      const canvas = document.createElement('canvas');
      canvas.width = format.width * scaleFactor;
      canvas.height = format.height * scaleFactor;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.scale(scaleFactor, scaleFactor);
      ctx.drawImage(img, 0, 0, format.width, format.height);
      URL.revokeObjectURL(url);

      const pngBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (!pngBlob) throw new Error('PNG export failed');

      const pngUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `ALMA-Grincs-Kartya-${themeId}-${format.width * 2}x${format.height * 2}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(pngUrl), 1500);
      setStatusMsg(
        `HD képeslap letöltve: ${format.width * 2}×${format.height * 2}px PNG (azonnal küldhető!)`
      );
    } catch (err) {
      setStatusMsg(
        `PNG hiba: ${err instanceof Error ? err.message : 'ismeretlen hiba'}`
      );
    }
  };

  const handleCopy3dPrompt = async () => {
    const cleanText = headline.replace(/\n/g, ' / ');
    const prompt = `Keep the exact hand-lettered typography shapes and layout from this reference greeting card ("${cleanText}"). Re-render the lettering as playful fluffy toxic-green Grinch fur with miniature red knitted Santa hats and shiny gold Christmas ornaments, soft studio macro photography, festive bokeh lights in background, crisp readable Hungarian accents.`;
    try {
      await navigator.clipboard.writeText(prompt);
      setStatusMsg('3D Grincs-szőrös AI prompt kimásolva!');
    } catch {
      setStatusMsg('A vágólap nem elérhető, próbáld újra.');
    }
  };

  const renderSelectionChrome = (target: SelectionTarget) => {
    if (target.type === 'core' && target.id === 'photo' && photoFrameMode === 'background') {
      return null;
    }
    const tr = getTargetTransform(target);
    if (!tr) return null;
    const { hw, hh } = getTargetHalfSize(target);
    const pad = 12;
    const w = (hw + pad) * 2;
    const h = (hh + pad) * 2;
    const invS = 1 / Math.max(0.35, tr.scale);
    const handleR = 11 * invS;
    const rotStem = 34 * invS;

    return (
      <g
        data-editor-only="true"
        transform={`translate(${tr.x}, ${tr.y}) rotate(${tr.rotation}) scale(${tr.scale})`}
      >
        <rect
          x={-w * 0.5}
          y={-h * 0.5}
          width={w}
          height={h}
          rx={8 * invS}
          fill="none"
          stroke="#5ee2a0"
          strokeWidth={2.5 * invS}
          strokeDasharray={`${8 * invS} ${6 * invS}`}
          pointerEvents="none"
        />
        <line
          x1={0}
          y1={-h * 0.5}
          x2={0}
          y2={-h * 0.5 - rotStem}
          stroke="#5ee2a0"
          strokeWidth={2.2 * invS}
          pointerEvents="none"
        />
        <circle
          cx={0}
          cy={-h * 0.5 - rotStem}
          r={handleR}
          fill="#5ee2a0"
          stroke="#0b0c10"
          strokeWidth={2.5 * invS}
          className="card-handle-rotate"
          onPointerDown={(e) => startRotate(e, target)}
        />
        <rect
          x={w * 0.5 - handleR}
          y={h * 0.5 - handleR}
          width={handleR * 2}
          height={handleR * 2}
          rx={4 * invS}
          fill="#ff6e54"
          stroke="#0b0c10"
          strokeWidth={2.5 * invS}
          className="card-handle-scale"
          onPointerDown={(e) => startScale(e, target)}
        />
        <rect
          x={-w * 0.5 - handleR}
          y={h * 0.5 - handleR}
          width={handleR * 2}
          height={handleR * 2}
          rx={4 * invS}
          fill="#ff6e54"
          stroke="#0b0c10"
          strokeWidth={2.5 * invS}
          className="card-handle-scale"
          onPointerDown={(e) => startScale(e, target)}
        />
      </g>
    );
  };

  const selectedTransform = selection ? getTargetTransform(selection) : null;
  const selectedSticker =
    selection?.type === 'sticker'
      ? stickers.find((s) => s.id === selection.id) ?? null
      : null;

  const selectedLabel = selection
    ? selection.type === 'core'
      ? CORE_LAYER_LABELS[selection.id]
      : selectedSticker
        ? STICKER_META_MAP[selectedSticker.kind].label
        : 'Matrica'
    : null;

  const updateSelectedStickerColor = (field: 'color' | 'accentColor', hex: string) => {
    if (selection?.type !== 'sticker') return;
    setStickers((prev) =>
      prev.map((s) => (s.id === selection.id ? { ...s, [field]: hex } : s))
    );
  };

  const updateCoreColor = (
    id: CoreLayerId,
    field: 'primary' | 'secondary',
    hex: string
  ) => {
    setCoreColors((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: hex },
    }));
  };

  return (
    <section className="card-studio-shell" aria-label="Karácsonyi Grincs Üdvözlőlap Stúdió">
      {/* Top Message Presets & Format Bar */}
      <div className="canvas-toolbar">
        <div className="sample-pills" role="group" aria-label="Grincses szöveg-ötletek">
          {MESSAGE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`pill-btn ${headline === p.headline ? 'is-active' : ''}`}
              onClick={() => applyMessagePreset(p)}
            >
              <Gift size={12} />
              {p.label}
            </button>
          ))}
        </div>

        <div className="sample-pills" role="group" aria-label="Képeslap formátum">
          {(Object.keys(CARD_FORMATS) as CardFormatId[]).map((fid) => (
            <button
              key={fid}
              type="button"
              className={`pill-btn ${formatId === fid ? 'is-active' : ''}`}
              onClick={() => handleFormatChange(fid)}
            >
              {CARD_FORMATS[fid].label}
            </button>
          ))}
        </div>
      </div>

      <div className="card-studio-layout">
        {/* Live Interactive Holiday Card Canvas */}
        <div className="card-preview-column">
          <div className="card-preview-frame">
            <svg
              ref={svgRef}
              className="holiday-card-svg interactive-card"
              viewBox={`0 0 ${format.width} ${format.height}`}
              onPointerMove={handleSvgPointerMove}
              onPointerUp={handleSvgPointerUp}
              onPointerCancel={handleSvgPointerUp}
              onClick={() => setSelection(null)}
            >
              <defs>
                <linearGradient id={`bg-${theme.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={customBgColor ?? theme.bgStart} />
                  <stop offset="100%" stopColor={customBgColor ?? theme.bgEnd} />
                </linearGradient>
                <radialGradient id="festive-glow" cx="50%" cy="42%" r="60%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
                </radialGradient>
                <clipPath id="photo-clip-circle">
                  <circle cx={0} cy={0} r={photoBox.imgW * 0.5} />
                </clipPath>
                <clipPath id="photo-clip-rounded">
                  <rect
                    x={-photoBox.imgW * 0.5}
                    y={-photoBox.imgH * 0.5}
                    width={photoBox.imgW}
                    height={photoBox.imgH}
                    rx={22}
                  />
                </clipPath>
                <clipPath id="photo-clip-polaroid">
                  <rect
                    x={-photoBox.imgW * 0.5}
                    y={-photoBox.h * 0.5 + 18}
                    width={photoBox.imgW}
                    height={photoBox.imgH}
                    rx={4}
                  />
                </clipPath>
              </defs>

              {/* Card Background */}
              <rect width={format.width} height={format.height} fill={`url(#bg-${theme.id})`} />
              <rect width={format.width} height={format.height} fill="url(#festive-glow)" />

              {/* Uploaded Photo in Full-Bleed Background Mode */}
              {uploadedPhoto && photoFrameMode === 'background' && (
                <g
                  className="card-draggable-layer"
                  transform={`translate(${coreTransforms.photo.x}, ${coreTransforms.photo.y}) rotate(${coreTransforms.photo.rotation}) scale(${coreTransforms.photo.scale})`}
                  onPointerDown={(e) => startMove(e, { type: 'core', id: 'photo' })}
                  onClick={(e) => e.stopPropagation()}
                >
                  <image
                    href={uploadedPhoto.dataUrl}
                    x={-photoBox.imgW * 0.5}
                    y={-photoBox.imgH * 0.5}
                    width={photoBox.imgW}
                    height={photoBox.imgH}
                    preserveAspectRatio="xMidYMid slice"
                  />
                </g>
              )}

              {uploadedPhoto && photoFrameMode === 'background' && (
                <rect
                  width={format.width}
                  height={format.height}
                  fill={customBgColor ?? theme.bgStart}
                  opacity={bgScrimOpacity / 100}
                  pointerEvents="none"
                />
              )}

              {/* Post-it Masking Tape for Office Grinch theme */}
              {themeId === 'postit-office' && (
                <g opacity={0.86} pointerEvents="none">
                  <rect
                    x={format.width * 0.5 - 110}
                    y={-14}
                    width={220}
                    height={56}
                    rx={4}
                    fill="rgba(255, 246, 214, 0.55)"
                    transform={`rotate(-2.5 ${format.width * 0.5} 14)`}
                  />
                </g>
              )}

              {/* Stitched inner frame */}
              <rect
                x={34}
                y={34}
                width={format.width - 68}
                height={format.height - 68}
                rx={22}
                fill="none"
                stroke={theme.frameColor}
                strokeWidth={3}
                strokeDasharray={themeId === 'ginger-gold' ? '14 10' : '6 8'}
                pointerEvents="none"
              />

              {/* Ambient Snow & subtle corner pine silhouettes */}
              {showSnow && (
                <g className="card-snow" pointerEvents="none">
                  {snowflakes.map((s, i) => (
                    <circle
                      key={i}
                      cx={s.cx}
                      cy={s.cy}
                      r={s.r}
                      fill={i % 5 === 0 ? theme.decorSecondary : '#ffffff'}
                      opacity={s.op}
                    />
                  ))}
                  <g
                    transform={`translate(66, ${format.height - 210})`}
                    opacity={themeId === 'postit-office' ? 0.22 : 0.34}
                  >
                    <path
                      d="M 54 165 L 48 128 L 10 134 L 44 84 L 18 90 L 56 32 L 72 8 Q 84 18 76 32 L 96 82 L 70 80 L 104 128 L 66 126 L 72 165 Z"
                      fill={theme.decorSecondary}
                    />
                    <circle cx={78} cy={12} r={9} fill={theme.decorAccent} />
                  </g>
                  <g
                    transform={`translate(${format.width - 182}, ${format.height - 196}) scale(-1, 1) translate(-112, 0)`}
                    opacity={themeId === 'postit-office' ? 0.22 : 0.34}
                  >
                    <path
                      d="M 54 155 L 48 122 L 16 128 L 46 80 L 22 86 L 56 32 L 72 10 L 92 78 L 68 76 L 98 122 L 66 120 L 70 155 Z"
                      fill={theme.decorSecondary}
                    />
                    <circle cx={73} cy={12} r={8} fill={theme.decorAccent} />
                  </g>
                </g>
              )}

              {/* MOVABLE CORE LAYER: Uploaded Photo Sticker */}
              {uploadedPhoto && photoFrameMode !== 'background' && (
                <g
                  className="card-draggable-layer"
                  transform={`translate(${coreTransforms.photo.x}, ${coreTransforms.photo.y}) rotate(${coreTransforms.photo.rotation}) scale(${coreTransforms.photo.scale})`}
                  onPointerDown={(e) => startMove(e, { type: 'core', id: 'photo' })}
                  onClick={(e) => e.stopPropagation()}
                >
                  {photoFrameMode === 'polaroid' && (
                    <>
                      <rect
                        x={-photoBox.w * 0.5 + 8}
                        y={-photoBox.h * 0.5 + 12}
                        width={photoBox.w}
                        height={photoBox.h}
                        rx={8}
                        fill="rgba(0,0,0,0.36)"
                      />
                      <rect
                        x={-photoBox.w * 0.5}
                        y={-photoBox.h * 0.5}
                        width={photoBox.w}
                        height={photoBox.h}
                        rx={8}
                        fill={resolvedPhotoFrame}
                      />
                      <image
                        href={uploadedPhoto.dataUrl}
                        x={-photoBox.imgW * 0.5}
                        y={-photoBox.h * 0.5 + 18}
                        width={photoBox.imgW}
                        height={photoBox.imgH}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath="url(#photo-clip-polaroid)"
                      />
                      <rect
                        x={-54}
                        y={-photoBox.h * 0.5 - 14}
                        width={108}
                        height={28}
                        rx={3}
                        fill="rgba(255, 224, 130, 0.72)"
                        transform="rotate(-4 0 -180)"
                      />
                    </>
                  )}

                  {photoFrameMode === 'rounded' && (
                    <>
                      <rect
                        x={-photoBox.w * 0.5 + 6}
                        y={-photoBox.h * 0.5 + 10}
                        width={photoBox.w}
                        height={photoBox.h}
                        rx={26}
                        fill="rgba(0,0,0,0.36)"
                      />
                      <rect
                        x={-photoBox.w * 0.5}
                        y={-photoBox.h * 0.5}
                        width={photoBox.w}
                        height={photoBox.h}
                        rx={26}
                        fill={resolvedPhotoFrame}
                      />
                      <image
                        href={uploadedPhoto.dataUrl}
                        x={-photoBox.imgW * 0.5}
                        y={-photoBox.imgH * 0.5}
                        width={photoBox.imgW}
                        height={photoBox.imgH}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath="url(#photo-clip-rounded)"
                      />
                    </>
                  )}

                  {photoFrameMode === 'circle' && (
                    <>
                      <circle cx={6} cy={10} r={photoBox.w * 0.5} fill="rgba(0,0,0,0.36)" />
                      <circle cx={0} cy={0} r={photoBox.w * 0.5} fill={resolvedPhotoFrame} />
                      <image
                        href={uploadedPhoto.dataUrl}
                        x={-photoBox.imgW * 0.5}
                        y={-photoBox.imgH * 0.5}
                        width={photoBox.imgW}
                        height={photoBox.imgH}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath="url(#photo-clip-circle)"
                      />
                    </>
                  )}
                </g>
              )}

              {/* MOVABLE CORE LAYER: HEADLINE */}
              <g
                className="card-draggable-layer"
                transform={`translate(${coreTransforms.headline.x}, ${coreTransforms.headline.y}) rotate(${coreTransforms.headline.rotation}) scale(${coreTransforms.headline.scale})`}
                onPointerDown={(e) => startMove(e, { type: 'core', id: 'headline' })}
                onClick={(e) => e.stopPropagation()}
              >
                <rect
                  x={-headlineBox.w * 0.5}
                  y={-headlineBox.h * 0.5}
                  width={headlineBox.w}
                  height={headlineBox.h}
                  fill="transparent"
                />
                {rawHeadline.lines.map((line, lIdx) => {
                  const startX = -(line.totalWidth * headlineFit) * 0.5;
                  const lineY =
                    -(rawHeadline.totalHeight * headlineFit) * 0.5 +
                    line.y * headlineFit;
                  return (
                    <g key={lIdx}>
                      {line.glyphs.map((g) => {
                        const gx = startX + g.x * headlineFit;
                        const gy = lineY + g.yOffset * headlineFit;
                        const fill = g.altColor
                          ? resolvedHeadlineAlt
                          : resolvedHeadlineColor;
                        return (
                          <g
                            key={g.key}
                            transform={`translate(${gx.toFixed(1)}, ${gy.toFixed(1)}) rotate(${g.rotDeg.toFixed(1)}) scale(${headlineScale.toFixed(4)})`}
                          >
                            <path
                              d={g.d}
                              transform="translate(32, 34)"
                              fill={theme.shadowColor}
                              fillRule="nonzero"
                              opacity={0.62}
                            />
                            <path d={g.d} fill={fill} fillRule="nonzero" />
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </g>

              {/* MOVABLE CORE LAYER: SUBLINE */}
              {subline.trim().length > 0 && (
                <g
                  className="card-draggable-layer"
                  transform={`translate(${coreTransforms.subline.x}, ${coreTransforms.subline.y}) rotate(${coreTransforms.subline.rotation}) scale(${coreTransforms.subline.scale})`}
                  onPointerDown={(e) => startMove(e, { type: 'core', id: 'subline' })}
                  onClick={(e) => e.stopPropagation()}
                >
                  <rect
                    x={-subBox.w * 0.5}
                    y={-subBox.h * 0.5}
                    width={subBox.w}
                    height={subBox.h}
                    fill="transparent"
                  />
                  {rawSub.lines.map((line, lIdx) => {
                    const startX = -(line.totalWidth * subFit) * 0.5;
                    const lineY =
                      -(rawSub.totalHeight * subFit) * 0.5 + line.y * subFit;
                    return (
                      <g key={lIdx}>
                        {line.glyphs.map((g) => (
                          <g
                            key={g.key}
                            transform={`translate(${(startX + g.x * subFit).toFixed(1)}, ${(lineY + g.yOffset * subFit).toFixed(1)}) rotate(${g.rotDeg.toFixed(1)}) scale(${subScale.toFixed(4)})`}
                          >
                            <path d={g.d} fill={resolvedSubColor} fillRule="nonzero" />
                          </g>
                        ))}
                      </g>
                    );
                  })}
                </g>
              )}

              {/* MOVABLE CORE LAYER: SIGNATURE PILL */}
              {signature.trim().length > 0 && (
                <g
                  className="card-draggable-layer"
                  transform={`translate(${coreTransforms.signature.x}, ${coreTransforms.signature.y}) rotate(${coreTransforms.signature.rotation}) scale(${coreTransforms.signature.scale})`}
                  onPointerDown={(e) => startMove(e, { type: 'core', id: 'signature' })}
                  onClick={(e) => e.stopPropagation()}
                >
                  <rect
                    x={-sigPillW * 0.5}
                    y={-sigPillH * 0.5}
                    width={sigPillW}
                    height={sigPillH}
                    rx={999}
                    fill={resolvedSigBg}
                  />
                  {rawSig.lines.map((line, lIdx) => {
                    const startX = -(line.totalWidth * sigFit) * 0.5;
                    const lineY =
                      -(rawSig.totalHeight * sigFit) * 0.5 + line.y * sigFit;
                    return (
                      <g key={lIdx}>
                        {line.glyphs.map((g) => (
                          <g
                            key={g.key}
                            transform={`translate(${(startX + g.x * sigFit).toFixed(1)}, ${lineY.toFixed(1)}) scale(${sigScale.toFixed(4)})`}
                          >
                            <path d={g.d} fill={resolvedSigText} fillRule="nonzero" />
                          </g>
                        ))}
                      </g>
                    );
                  })}
                </g>
              )}

              {/* DYNAMIC OPTIONAL STICKERS (rendered on top so hats/antlers/noses sit over photos!) */}
              {stickers.map((st) => (
                <g
                  key={st.id}
                  className="card-draggable-layer"
                  transform={`translate(${st.x}, ${st.y}) rotate(${st.rotation}) scale(${st.scale})`}
                  onPointerDown={(e) => startMove(e, { type: 'sticker', id: st.id })}
                  onClick={(e) => e.stopPropagation()}
                >
                  <StickerGraphic
                    kind={st.kind}
                    color={st.color}
                    accentColor={st.accentColor}
                    outlineColor={theme.shadowColor}
                  />
                </g>
              ))}

              {/* Subtle handcrafted footer credit */}
              <text
                x={format.width * 0.5}
                y={format.height - 46}
                textAnchor="middle"
                fill={theme.frameColor}
                fontSize="13"
                fontWeight="700"
                letterSpacing="2.4"
                fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
                pointerEvents="none"
              >
                HAND-LETTERED WITH {fontName.toUpperCase()}
              </text>

              {/* Editor-only selection handles (stripped on export) */}
              {selection && renderSelectionChrome(selection)}
            </svg>
          </div>

          <div className="card-canvas-tip">
            <Move size={13} />
            <span>
              Kattints bármelyik elemre a kártyán: húzással mozgathatod, a <strong>narancs sarkokkal</strong> méretezheted, a <strong>zöld körrel</strong> forgathatod, jobbra pedig <strong>átszínezheted</strong> (Delete: matrica törlése).
            </span>
          </div>
        </div>

        {/* Card Editor Controls */}
        <div className="card-controls-col">
          {/* Selected Element Transform + Recolor Inspector */}
          <div className="panel-card inspector-highlight-card">
            <div className="panel-card-header">
              <span className="section-eyebrow">
                <Palette size={12} style={{ marginRight: 6 }} />
                {selectedLabel ? `Kijelölt: ${selectedLabel}` : 'Kijelölt elem & Átszínezés'}
              </span>
              <button
                type="button"
                className="mini-btn"
                onClick={resetAllLayouts}
                title="Minden elem pozíciójának és színének visszaállítása"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            </div>

            <div className="layer-quick-pills">
              {(
                [
                  ...(uploadedPhoto ? (['photo'] as CoreLayerId[]) : []),
                  'headline',
                  'subline',
                  'signature',
                ] as CoreLayerId[]
              ).map((cid) => (
                <button
                  key={cid}
                  type="button"
                  className={`pill-btn ${selection?.type === 'core' && selection.id === cid ? 'is-active' : ''}`}
                  onClick={() => setSelection({ type: 'core', id: cid })}
                >
                  {CORE_LAYER_LABELS[cid]}
                </button>
              ))}
              {stickers.map((st, idx) => (
                <button
                  key={st.id}
                  type="button"
                  className={`pill-btn ${selection?.type === 'sticker' && selection.id === st.id ? 'is-active' : ''}`}
                  onClick={() => setSelection({ type: 'sticker', id: st.id })}
                >
                  {STICKER_META_MAP[st.kind].emoji} {STICKER_META_MAP[st.kind].label}
                  {stickers.filter((x) => x.kind === st.kind).length > 1 ? ` #${idx + 1}` : ''}
                </button>
              ))}
            </div>

            {selection && selectedTransform ? (
              <div className="sliders-stack">
                {/* Per-element Color Pickers */}
                {selection.type === 'core' && selection.id === 'headline' && (
                  <>
                    <ColorSwatchPicker
                      label="Főcím fő színe"
                      value={resolvedHeadlineColor}
                      onChange={(hex) => updateCoreColor('headline', 'primary', hex)}
                    />
                    <ColorSwatchPicker
                      label="Főcím kiemelő (2.) színe"
                      value={resolvedHeadlineAlt}
                      onChange={(hex) => updateCoreColor('headline', 'secondary', hex)}
                    />
                  </>
                )}

                {selection.type === 'core' && selection.id === 'subline' && (
                  <ColorSwatchPicker
                    label="Alcím színe"
                    value={resolvedSubColor}
                    onChange={(hex) => updateCoreColor('subline', 'primary', hex)}
                  />
                )}

                {selection.type === 'core' && selection.id === 'signature' && (
                  <>
                    <ColorSwatchPicker
                      label="Aláírás címke háttere"
                      value={resolvedSigBg}
                      onChange={(hex) => updateCoreColor('signature', 'primary', hex)}
                    />
                    <ColorSwatchPicker
                      label="Aláírás szöveg színe"
                      value={resolvedSigText}
                      onChange={(hex) => updateCoreColor('signature', 'secondary', hex)}
                    />
                  </>
                )}

                {selection.type === 'core' &&
                  selection.id === 'photo' &&
                  photoFrameMode !== 'background' && (
                    <ColorSwatchPicker
                      label="Fotó keret színe"
                      value={resolvedPhotoFrame}
                      onChange={(hex) => updateCoreColor('photo', 'primary', hex)}
                    />
                  )}

                {selection.type === 'sticker' && selectedSticker && (
                  <>
                    <ColorSwatchPicker
                      label="Matrica fő színe"
                      value={selectedSticker.color}
                      onChange={(hex) => updateSelectedStickerColor('color', hex)}
                    />
                    <ColorSwatchPicker
                      label="Matrica díszítő színe"
                      value={selectedSticker.accentColor}
                      onChange={(hex) => updateSelectedStickerColor('accentColor', hex)}
                    />
                  </>
                )}

                <RangeSlider
                  label="Méret (Scale)"
                  value={Math.round(selectedTransform.scale * 100)}
                  min={25}
                  max={260}
                  unit="%"
                  onChange={(v) => patchTargetTransform(selection, { scale: v / 100 })}
                />
                <RangeSlider
                  label="Forgatás"
                  value={selectedTransform.rotation}
                  min={-180}
                  max={180}
                  unit="°"
                  onChange={(v) => patchTargetTransform(selection, { rotation: v })}
                />

                <div className="sketch-actions">
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() =>
                      patchTargetTransform(selection, { x: Math.round(format.width * 0.5) })
                    }
                  >
                    Középre
                  </button>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => patchTargetTransform(selection, { rotation: 0, scale: 1 })}
                  >
                    100% / 0°
                  </button>
                  {selection.type === 'sticker' && (
                    <>
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={handleDuplicateSelectedSticker}
                        title="Másolat készítése (pl. több Mikulás-sapka a fotóra)"
                      >
                        <CopyPlus size={12} />
                        Duplikál
                      </button>
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() => handleReorderSticker('up')}
                        title="Réteg előrehozása"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() => handleReorderSticker('down')}
                        title="Réteg hátraküldése"
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        className="mini-btn danger-mini"
                        onClick={handleDeleteSelectedSticker}
                        title="Matrica törlése"
                      >
                        <Trash2 size={12} />
                        Törlés
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <p className="inspector-empty-note">
                Kattints fent egy elemre vagy közvetlenül a kártyára a méret, forgatás és szín módosításához.
              </p>
            )}
          </div>

          {/* Optional Grinch & Christmas Stickers Catalog */}
          <div className="panel-card">
            <div className="panel-card-header">
              <span className="section-eyebrow">
                <Plus size={12} style={{ marginRight: 5 }} />
                Opcionális elemek (+ rákattintva hozzáadja)
              </span>
            </div>
            <div className="sticker-catalog-grid">
              {STICKER_CATALOG.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  className="sticker-add-btn"
                  onClick={() => handleAddSticker(item.kind)}
                >
                  <span className="sticker-emoji" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <span className="sticker-label">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Upload Own Photo Card */}
          <div className="panel-card">
            <div className="panel-card-header">
              <span className="section-eyebrow">Saját fotó a kártyára</span>
              {uploadedPhoto && (
                <button
                  type="button"
                  className="mini-btn"
                  onClick={handleRemovePhoto}
                  title="Fotó eltávolítása"
                >
                  <Trash2 size={12} />
                  Törlés
                </button>
              )}
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handlePhotoUpload}
            />

            <button
              type="button"
              className="photo-upload-btn"
              onClick={() => photoInputRef.current?.click()}
            >
              <ImagePlus size={16} />
              {uploadedPhoto
                ? `Csere: ${uploadedPhoto.name}`
                : 'Saját fotó feltöltése (család / csapat / kutya)'}
            </button>

            {uploadedPhoto && (
              <>
                <div className="sample-pills" role="group" aria-label="Fotó keret stílus">
                  {(
                    [
                      { id: 'polaroid', label: 'Polaroid' },
                      { id: 'rounded', label: 'Lekerekített' },
                      { id: 'circle', label: 'Kör' },
                      { id: 'background', label: 'Teljes háttér' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`pill-btn ${photoFrameMode === m.id ? 'is-active' : ''}`}
                      onClick={() => handlePhotoModeChange(m.id)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {photoFrameMode === 'background' && (
                  <RangeSlider
                    label="Háttér sötétítés (olvashatóság)"
                    value={bgScrimOpacity}
                    min={0}
                    max={85}
                    unit="%"
                    onChange={setBgScrimOpacity}
                  />
                )}
              </>
            )}
          </div>

          {/* Themes + Custom Background Color */}
          <div className="panel-card">
            <div className="panel-card-header">
              <span className="section-eyebrow">
                <Trees size={12} style={{ marginRight: 6 }} />
                Dizájn témák &amp; Háttérszín
              </span>
            </div>
            <div className="theme-cards-grid">
              {CARD_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-tile ${themeId === t.id && !customBgColor ? 'is-active' : ''}`}
                  onClick={() => handleSelectTheme(t.id)}
                >
                  <span
                    className="theme-tile-swatch"
                    style={{
                      background: `linear-gradient(135deg, ${t.bgStart}, ${t.bgEnd})`,
                      borderColor: t.headlineColor,
                    }}
                  />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <ColorSwatchPicker
              label="Kártya háttérszín felülírása"
              value={customBgColor ?? theme.bgStart}
              onChange={(hex) => setCustomBgColor(hex)}
            />
          </div>

          {/* Text Inputs */}
          <div className="panel-card">
            <div className="panel-card-header">
              <span className="section-eyebrow">Képeslap szövege</span>
            </div>

            <label className="font-name-label" htmlFor="card-headline">
              Főcím (Enterrel több sorba törhető)
            </label>
            <textarea
              id="card-headline"
              className="card-textarea"
              rows={2}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />

            <label className="font-name-label" htmlFor="card-subline">
              Alcím / Poén
            </label>
            <input
              id="card-subline"
              type="text"
              className="font-name-input"
              value={subline}
              onChange={(e) => setSubline(e.target.value)}
            />

            <label className="font-name-label" htmlFor="card-signature">
              Aláírás / Feladó
            </label>
            <input
              id="card-signature"
              type="text"
              className="font-name-input"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
            />
          </div>

          {/* Font & Grinch Vibe */}
          <div className="panel-card">
            <div className="panel-card-header">
              <span className="section-eyebrow">Betű &amp; Grincs-hangulat</span>
            </div>

            <div className="sample-pills" role="group" aria-label="Kártya betűsúly">
              {(
                [
                  { id: 'regular', label: 'Regular' },
                  { id: 'bold', label: 'Bold' },
                  { id: 'molten', label: 'Molten Grincs' },
                ] as const
              ).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={`pill-btn ${weight === w.id ? 'is-active' : ''}`}
                  onClick={() => setWeight(w.id)}
                >
                  {w.label}
                </button>
              ))}
            </div>

            <RangeSlider
              label="Főcím alapméret"
              value={headlineSize}
              min={64}
              max={168}
              unit="px"
              onChange={setHeadlineSize}
            />
            <RangeSlider
              label="Grincs-káosz (dőlés & ugrálás)"
              value={grinchChaos}
              min={0}
              max={100}
              unit="%"
              onChange={setGrinchChaos}
            />

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={showSnow}
                onChange={(e) => setShowSnow(e.target.checked)}
              />
              <span>Hóesés és sarok-fenyők a háttérben</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={festiveColors}
                onChange={(e) => setFestiveColors(e.target.checked)}
              />
              <span>Ünnepi kétszínű kiemelés a főcímen</span>
            </label>
          </div>

          {/* Export */}
          <div className="panel-card">
            <div className="panel-card-header">
              <span className="section-eyebrow">Küldhető kártya export</span>
            </div>
            <div className="export-buttons">
              <button
                type="button"
                className="primary-export-btn"
                onClick={handleDownloadPng}
              >
                <Download size={16} />
                Download PNG (HD)
              </button>
              <button
                type="button"
                className="secondary-export-btn"
                onClick={handleDownloadSvg}
              >
                <FileCode2 size={16} />
                Export .svg
              </button>
            </div>
            <button
              type="button"
              className="family-export-btn"
              onClick={handleCopy3dPrompt}
              title="Kész prompt másolása 3D szőrös Grincs-renderhez"
            >
              <Sparkles size={14} />
              3D Grincs-szőrös AI prompt másolása
              <Copy size={13} />
            </button>
            {statusMsg && (
              <div className="export-status" role="status" aria-live="polite">
                {statusMsg}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
