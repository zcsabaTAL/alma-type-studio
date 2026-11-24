import { ConstructionParams, SavedHandwriting } from '../types/font';

const STORAGE_KEY = 'alma-type-studio:handwritings:v1';

export const ALL_PIECES_ON: ConstructionParams['activePieces'] = {
  'stem-left': true,
  'stem-right': true,
  'crossbar-rise': true,
  'foot-kick': true,
  'apex-spike': true,
  'diag-plunge': true,
};

export const BUILTIN_HANDWRITINGS: SavedHandwriting[] = [
  {
    id: 'builtin-alma-postit',
    name: 'ALMA Post-it (Golyóstoll)',
    isBuiltIn: true,
    createdAt: 1,
    kerningStrength: 100,
    manualKerning: {},
    overrides: {},
    params: {
      pieceVariation: 46,
      exaggeration: 58,
      jointMelt: 22,
      counterPinch: 18,
      limbDrop: 12,
      baselineBounce: 24,
      waistHeight: 46,
      strokeWeight: 36,
      activePieces: { ...ALL_PIECES_ON },
    },
  },
  {
    id: 'builtin-molten-grinch',
    name: 'Molten Grincs (Vastag)',
    isBuiltIn: true,
    createdAt: 2,
    kerningStrength: 100,
    manualKerning: {},
    overrides: {},
    params: {
      pieceVariation: 36,
      exaggeration: 64,
      jointMelt: 82,
      counterPinch: 46,
      limbDrop: 28,
      baselineBounce: 34,
      waistHeight: 44,
      strokeWeight: 56,
      activePieces: { ...ALL_PIECES_ON },
    },
  },
  {
    id: 'builtin-fine-pen',
    name: 'Finom Tűfilc (Elegáns)',
    isBuiltIn: true,
    createdAt: 3,
    kerningStrength: 95,
    manualKerning: {},
    overrides: {},
    params: {
      pieceVariation: 22,
      exaggeration: 34,
      jointMelt: 10,
      counterPinch: 8,
      limbDrop: 18,
      baselineBounce: 12,
      waistHeight: 50,
      strokeWeight: 24,
      activePieces: {
        ...ALL_PIECES_ON,
        'apex-spike': false,
      },
    },
  },
];

export function loadSavedHandwritings(): SavedHandwriting[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...BUILTIN_HANDWRITINGS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...BUILTIN_HANDWRITINGS];
    }
    // Ensure built-ins remain available if user hasn't explicitly replaced everything
    const customOnly = parsed.filter(
      (item: SavedHandwriting) =>
        item && typeof item.id === 'string' && typeof item.name === 'string' && item.params
    );
    return customOnly.length > 0 ? customOnly : [...BUILTIN_HANDWRITINGS];
  } catch {
    return [...BUILTIN_HANDWRITINGS];
  }
}

export function persistSavedHandwritings(list: SavedHandwriting[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    // Fallback: strip optional sketch thumbnails if localStorage quota is tight
    try {
      const compact = list.map((item) => ({ ...item, sketchThumbUrl: undefined }));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
      return true;
    } catch {
      return false;
    }
  }
}

/** Downscale any image URL to a tiny ~4KB thumbnail safe for localStorage persistence */
export async function createCompactThumb(imageUrl: string): Promise<string | undefined> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('thumb load failed'));
      el.src = imageUrl;
    });
    const maxDim = 140;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(24, Math.round(img.width * scale));
    const h = Math.max(24, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return undefined;
  }
}
