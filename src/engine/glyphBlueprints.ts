import { ExtractedPiece, PieceId } from '../types/font';

export interface StrokeBlueprint {
  /** Normalized points in glyph box: x in [0..width], y in [-0.30..1.25] where 0=baseline, 1=capHeight */
  pts: [number, number][];
  piece: PieceId | 'curve' | 'diacritic';
  taper?: 'sharp' | 'chisel' | 'taper-end' | 'taper-start' | 'uniform';
  weightScale?: number;
  /** Shifts y with waistHeight slider (0..1 influence) */
  waistInfluence?: number;
  /** Shifts y downward with limbDrop slider */
  limbDropEnd?: 'start' | 'end' | 'both';
  /** Applies upward-tilted crossbar/foot DNA */
  riseSlope?: number;
  /** Marks closed or semi-closed loop stroke for counter pinch */
  isCounter?: boolean;
  /** Diacritics do not melt into the base glyph */
  isDiacritic?: boolean;
}

export interface GlyphBlueprint {
  width: number; // relative to capHeight=1.0 (condensed ALMA avg ~0.58)
  strokes: StrokeBlueprint[];
  isLower?: boolean;
}

export const EXTRACTED_PIECES: ExtractedPiece[] = [
  {
    id: 'stem-left',
    label: 'Slanted Stem',
    sourceRef: 'ALMA · A & M bal szár',
    description: 'Előredőlő, középen duzzadó, tűhegyes végű főszár',
    previewPath: 'M 18 54 Q 26 30 40 8 Q 44 10 32 34 Q 24 50 18 54 Z',
  },
  {
    id: 'stem-right',
    label: 'Dagger Spine',
    sourceRef: 'ALMA · A & M jobb szár',
    description: 'Meredekebb, tőrszerűen elvékonyodó jobb szár',
    previewPath: 'M 32 8 Q 38 28 42 54 Q 35 46 32 28 Q 30 16 32 8 Z',
  },
  {
    id: 'crossbar-rise',
    label: 'Rising Slash',
    sourceRef: 'ALMA · A keresztszár',
    description: '22°-ban felfelé csapó, ék alakú keresztszár',
    previewPath: 'M 10 40 Q 28 31 52 22 Q 48 29 29 37 Q 16 42 10 40 Z',
  },
  {
    id: 'foot-kick',
    label: 'Kicked Foot',
    sourceRef: 'ALMA · L felcsapó talp',
    description: 'Energikusan felfelé rúgó alsó vízszintes talp',
    previewPath: 'M 12 48 Q 30 39 50 28 Q 47 36 28 46 Q 16 52 12 48 Z',
  },
  {
    id: 'apex-spike',
    label: 'Pinched Apex',
    sourceRef: 'ALMA · A & M csúcs',
    description: 'Összecsípett, enyhén túlfutó, kettős tollhegyű csúcs',
    previewPath: 'M 16 50 L 31 8 L 46 50 L 38 48 L 31 20 L 23 48 Z',
  },
  {
    id: 'diag-plunge',
    label: 'Deep Plunge',
    sourceRef: 'ALMA · M mély V-szár',
    description: 'Alapvonalig zuhanó, éles belső átló',
    previewPath: 'M 14 10 Q 24 30 31 52 Q 40 30 50 10 L 44 12 L 31 41 L 20 12 Z',
  },
];

// Helper to build smooth curve polylines for ovals/bowls with ALMA condensed tall proportions
function arcPts(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startDeg: number,
  endDeg: number,
  steps = 10
): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const rad = ((startDeg + (endDeg - startDeg) * t) * Math.PI) / 180;
    out.push([cx + Math.cos(rad) * rx, cy + Math.sin(rad) * ry]);
  }
  return out;
}

// Hungarian diacritic stroke builders (anchored in normalized glyph coordinates)
function acuteAccent(cx: number, baseY: number): StrokeBlueprint[] {
  return [
    {
      pts: [
        [cx - 0.04, baseY + 0.05],
        [cx + 0.08, baseY + 0.21],
      ],
      piece: 'diacritic',
      taper: 'sharp',
      weightScale: 0.82,
      isDiacritic: true,
    },
  ];
}

function diaeresisAccent(cx: number, baseY: number): StrokeBlueprint[] {
  return [
    {
      pts: [
        [cx - 0.11, baseY + 0.07],
        [cx - 0.08, baseY + 0.16],
      ],
      piece: 'diacritic',
      taper: 'chisel',
      weightScale: 0.9,
      isDiacritic: true,
    },
    {
      pts: [
        [cx + 0.07, baseY + 0.08],
        [cx + 0.1, baseY + 0.17],
      ],
      piece: 'diacritic',
      taper: 'chisel',
      weightScale: 0.9,
      isDiacritic: true,
    },
  ];
}

function doubleAcuteAccent(cx: number, baseY: number): StrokeBlueprint[] {
  return [
    {
      pts: [
        [cx - 0.11, baseY + 0.05],
        [cx - 0.01, baseY + 0.21],
      ],
      piece: 'diacritic',
      taper: 'sharp',
      weightScale: 0.78,
      isDiacritic: true,
    },
    {
      pts: [
        [cx + 0.02, baseY + 0.06],
        [cx + 0.13, baseY + 0.22],
      ],
      piece: 'diacritic',
      taper: 'sharp',
      weightScale: 0.78,
      isDiacritic: true,
    },
  ];
}

function withDiacritic(base: GlyphBlueprint, accents: StrokeBlueprint[]): GlyphBlueprint {
  return {
    ...base,
    strokes: [...base.strokes, ...accents],
  };
}

const UPPER: Record<string, GlyphBlueprint> = {
  // Directly modeled on Zoli's ALMA Post-it sketch!
  A: {
    width: 0.62,
    strokes: [
      {
        pts: [
          [0.05, 0.0],
          [0.19, 0.52],
          [0.33, 1.02],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.08,
      },
      {
        pts: [
          [0.34, 1.02],
          [0.45, 0.54],
          [0.54, 0.01],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.02,
        limbDropEnd: 'end',
      },
      {
        pts: [
          [0.16, 0.36],
          [0.34, 0.44],
          [0.48, 0.52],
        ],
        piece: 'crossbar-rise',
        taper: 'chisel',
        weightScale: 0.96,
        waistInfluence: 1.0,
        riseSlope: 1.0,
        isCounter: true,
      },
      // Signature pinched apex accent
      {
        pts: [
          [0.29, 0.89],
          [0.335, 1.04],
          [0.38, 0.88],
        ],
        piece: 'apex-spike',
        taper: 'sharp',
        weightScale: 0.78,
      },
    ],
  },

  B: {
    width: 0.58,
    strokes: [
      {
        pts: [
          [0.1, 0.0],
          [0.1, 0.5],
          [0.11, 1.0],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.06,
      },
      {
        pts: [
          [0.1, 0.99],
          [0.34, 1.0],
          [0.48, 0.88],
          [0.49, 0.72],
          [0.36, 0.56],
          [0.11, 0.52],
        ],
        piece: 'curve',
        taper: 'chisel',
        weightScale: 0.94,
        waistInfluence: 0.55,
        isCounter: true,
      },
      {
        pts: [
          [0.11, 0.52],
          [0.38, 0.54],
          [0.52, 0.38],
          [0.51, 0.16],
          [0.35, 0.02],
          [0.09, 0.0],
        ],
        piece: 'curve',
        taper: 'chisel',
        weightScale: 1.0,
        waistInfluence: 0.45,
        isCounter: true,
      },
    ],
  },

  C: {
    width: 0.56,
    strokes: [
      {
        pts: [
          [0.49, 0.86],
          [0.38, 0.99],
          [0.22, 0.97],
          [0.1, 0.74],
          [0.08, 0.45],
          [0.12, 0.17],
          [0.24, 0.01],
          [0.41, 0.05],
          [0.51, 0.19],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 1.04,
      },
      {
        pts: [
          [0.22, 0.01],
          [0.39, 0.06],
          [0.51, 0.19],
        ],
        piece: 'foot-kick',
        taper: 'sharp',
        weightScale: 0.9,
        riseSlope: 0.7,
      },
    ],
  },

  D: {
    width: 0.6,
    strokes: [
      {
        pts: [
          [0.1, 0.0],
          [0.1, 0.5],
          [0.11, 1.0],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.08,
      },
      {
        pts: [
          [0.11, 0.99],
          [0.35, 0.98],
          [0.51, 0.79],
          [0.53, 0.48],
          [0.48, 0.18],
          [0.32, 0.02],
          [0.09, 0.0],
        ],
        piece: 'curve',
        taper: 'chisel',
        weightScale: 1.0,
        isCounter: true,
      },
    ],
  },

  E: {
    width: 0.54,
    strokes: [
      {
        pts: [
          [0.11, 0.0],
          [0.11, 0.5],
          [0.12, 1.0],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.06,
      },
      {
        pts: [
          [0.12, 0.96],
          [0.31, 0.99],
          [0.48, 1.02],
        ],
        piece: 'crossbar-rise',
        taper: 'sharp',
        weightScale: 0.92,
        riseSlope: 0.55,
      },
      {
        pts: [
          [0.11, 0.49],
          [0.29, 0.53],
          [0.44, 0.57],
        ],
        piece: 'crossbar-rise',
        taper: 'chisel',
        weightScale: 0.92,
        waistInfluence: 1.0,
        riseSlope: 0.85,
      },
      {
        pts: [
          [0.1, 0.0],
          [0.3, 0.06],
          [0.49, 0.14],
        ],
        piece: 'foot-kick',
        taper: 'sharp',
        weightScale: 1.0,
        riseSlope: 1.0,
      },
    ],
  },

  F: {
    width: 0.52,
    strokes: [
      {
        pts: [
          [0.12, 0.0],
          [0.12, 0.5],
          [0.13, 1.0],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.08,
        limbDropEnd: 'start',
      },
      {
        pts: [
          [0.13, 0.96],
          [0.32, 0.99],
          [0.48, 1.02],
        ],
        piece: 'crossbar-rise',
        taper: 'sharp',
        weightScale: 0.94,
        riseSlope: 0.6,
      },
      {
        pts: [
          [0.12, 0.5],
          [0.29, 0.55],
          [0.44, 0.59],
        ],
        piece: 'crossbar-rise',
        taper: 'chisel',
        weightScale: 0.92,
        waistInfluence: 1.0,
        riseSlope: 0.9,
      },
    ],
  },

  G: {
    width: 0.6,
    strokes: [
      {
        pts: [
          [0.5, 0.86],
          [0.38, 0.99],
          [0.22, 0.96],
          [0.1, 0.73],
          [0.08, 0.44],
          [0.13, 0.15],
          [0.28, 0.01],
          [0.46, 0.07],
          [0.52, 0.28],
          [0.51, 0.47],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 1.02,
      },
      {
        pts: [
          [0.3, 0.44],
          [0.42, 0.47],
          [0.53, 0.5],
        ],
        piece: 'crossbar-rise',
        taper: 'chisel',
        weightScale: 0.92,
        waistInfluence: 0.8,
        riseSlope: 0.7,
      },
    ],
  },

  H: {
    width: 0.6,
    strokes: [
      {
        pts: [
          [0.1, 0.0],
          [0.1, 0.5],
          [0.11, 1.01],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.08,
      },
      {
        pts: [
          [0.5, 1.01],
          [0.5, 0.5],
          [0.49, 0.0],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.04,
        limbDropEnd: 'end',
      },
      {
        pts: [
          [0.1, 0.46],
          [0.3, 0.52],
          [0.5, 0.57],
        ],
        piece: 'crossbar-rise',
        taper: 'chisel',
        weightScale: 0.96,
        waistInfluence: 1.0,
        riseSlope: 1.0,
      },
    ],
  },

  I: {
    width: 0.3,
    strokes: [
      {
        pts: [
          [0.15, 0.0],
          [0.15, 0.5],
          [0.16, 1.01],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.12,
      },
    ],
  },

  J: {
    width: 0.48,
    strokes: [
      {
        pts: [
          [0.37, 1.01],
          [0.37, 0.5],
          [0.34, 0.14],
          [0.22, 0.0],
          [0.09, 0.07],
          [0.06, 0.22],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.06,
        limbDropEnd: 'end',
      },
    ],
  },

  K: {
    width: 0.58,
    strokes: [
      {
        pts: [
          [0.1, 0.0],
          [0.1, 0.5],
          [0.11, 1.01],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.08,
      },
      {
        pts: [
          [0.51, 1.01],
          [0.31, 0.72],
          [0.12, 0.46],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 0.98,
        waistInfluence: 0.7,
      },
      {
        pts: [
          [0.21, 0.57],
          [0.37, 0.29],
          [0.52, 0.0],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.02,
        limbDropEnd: 'end',
      },
    ],
  },

  // Directly modeled on Zoli's ALMA Post-it L!
  L: {
    width: 0.52,
    strokes: [
      {
        pts: [
          [0.1, 0.02],
          [0.12, 0.52],
          [0.14, 1.03],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.1,
      },
      {
        pts: [
          [0.09, 0.01],
          [0.28, 0.1],
          [0.48, 0.2],
        ],
        piece: 'foot-kick',
        taper: 'sharp',
        weightScale: 1.08,
        riseSlope: 1.15,
      },
    ],
  },

  // Directly modeled on Zoli's ALMA Post-it M!
  M: {
    width: 0.78,
    strokes: [
      {
        pts: [
          [0.05, 0.0],
          [0.17, 0.54],
          [0.27, 1.02],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.06,
      },
      {
        pts: [
          [0.28, 1.01],
          [0.36, 0.56],
          [0.41, 0.14],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 0.98,
      },
      {
        pts: [
          [0.41, 0.15],
          [0.53, 0.58],
          [0.65, 1.0],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 0.98,
      },
      {
        pts: [
          [0.66, 0.99],
          [0.69, 0.52],
          [0.69, 0.04],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.04,
        limbDropEnd: 'end',
      },
      {
        pts: [
          [0.23, 0.89],
          [0.275, 1.04],
          [0.31, 0.88],
        ],
        piece: 'apex-spike',
        taper: 'sharp',
        weightScale: 0.76,
      },
    ],
  },

  N: {
    width: 0.62,
    strokes: [
      {
        pts: [
          [0.1, 0.0],
          [0.1, 0.5],
          [0.11, 1.01],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.06,
      },
      {
        pts: [
          [0.12, 1.0],
          [0.32, 0.5],
          [0.5, 0.01],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 1.0,
      },
      {
        pts: [
          [0.51, 0.01],
          [0.52, 0.52],
          [0.52, 1.01],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.04,
      },
    ],
  },

  O: {
    width: 0.6,
    strokes: [
      {
        pts: arcPts(0.3, 0.5, 0.22, 0.49, 0, 360, 20),
        piece: 'curve',
        taper: 'uniform',
        weightScale: 1.02,
        isCounter: true,
      },
    ],
  },

  P: {
    width: 0.56,
    strokes: [
      {
        pts: [
          [0.11, 0.0],
          [0.11, 0.5],
          [0.12, 1.01],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.08,
        limbDropEnd: 'start',
      },
      {
        pts: [
          [0.12, 0.99],
          [0.36, 0.99],
          [0.5, 0.85],
          [0.49, 0.63],
          [0.35, 0.5],
          [0.11, 0.48],
        ],
        piece: 'curve',
        taper: 'chisel',
        weightScale: 0.96,
        waistInfluence: 0.8,
        isCounter: true,
      },
    ],
  },

  Q: {
    width: 0.62,
    strokes: [
      {
        pts: arcPts(0.3, 0.51, 0.22, 0.48, 0, 360, 20),
        piece: 'curve',
        taper: 'uniform',
        weightScale: 1.02,
        isCounter: true,
      },
      {
        pts: [
          [0.34, 0.24],
          [0.46, 0.09],
          [0.57, -0.06],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 0.98,
        limbDropEnd: 'end',
      },
    ],
  },

  R: {
    width: 0.58,
    strokes: [
      {
        pts: [
          [0.1, 0.0],
          [0.1, 0.5],
          [0.11, 1.01],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.08,
      },
      {
        pts: [
          [0.11, 0.99],
          [0.36, 0.99],
          [0.49, 0.85],
          [0.48, 0.64],
          [0.34, 0.51],
          [0.11, 0.49],
        ],
        piece: 'curve',
        taper: 'chisel',
        weightScale: 0.96,
        waistInfluence: 0.75,
        isCounter: true,
      },
      {
        pts: [
          [0.27, 0.51],
          [0.41, 0.26],
          [0.53, 0.0],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.04,
        limbDropEnd: 'end',
      },
    ],
  },

  S: {
    width: 0.54,
    strokes: [
      {
        pts: [
          [0.46, 0.88],
          [0.35, 0.99],
          [0.19, 0.96],
          [0.1, 0.8],
          [0.15, 0.62],
          [0.33, 0.49],
          [0.47, 0.35],
          [0.48, 0.16],
          [0.35, 0.01],
          [0.17, 0.03],
          [0.07, 0.15],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 1.04,
      },
    ],
  },

  T: {
    width: 0.56,
    strokes: [
      {
        pts: [
          [0.28, 0.0],
          [0.28, 0.5],
          [0.29, 0.98],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.08,
        limbDropEnd: 'start',
      },
      {
        pts: [
          [0.05, 0.92],
          [0.28, 0.98],
          [0.53, 1.03],
        ],
        piece: 'crossbar-rise',
        taper: 'sharp',
        weightScale: 1.0,
        riseSlope: 0.85,
      },
    ],
  },

  U: {
    width: 0.6,
    strokes: [
      {
        pts: [
          [0.1, 1.01],
          [0.1, 0.32],
          [0.17, 0.07],
          [0.31, 0.0],
          [0.45, 0.09],
          [0.5, 0.34],
          [0.51, 1.01],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.04,
      },
    ],
  },

  V: {
    width: 0.6,
    strokes: [
      {
        pts: [
          [0.07, 1.01],
          [0.19, 0.49],
          [0.3, 0.0],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 1.06,
      },
      {
        pts: [
          [0.3, 0.0],
          [0.42, 0.5],
          [0.54, 1.01],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.02,
      },
      {
        pts: [
          [0.25, 0.14],
          [0.3, -0.02],
          [0.35, 0.14],
        ],
        piece: 'apex-spike',
        taper: 'sharp',
        weightScale: 0.78,
      },
    ],
  },

  W: {
    width: 0.82,
    strokes: [
      {
        pts: [
          [0.05, 1.01],
          [0.14, 0.48],
          [0.22, 0.01],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.04,
      },
      {
        pts: [
          [0.22, 0.01],
          [0.33, 0.46],
          [0.41, 0.82],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 0.96,
      },
      {
        pts: [
          [0.41, 0.82],
          [0.5, 0.42],
          [0.59, 0.01],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 0.96,
      },
      {
        pts: [
          [0.59, 0.01],
          [0.68, 0.5],
          [0.76, 1.01],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.04,
      },
    ],
  },

  X: {
    width: 0.6,
    strokes: [
      {
        pts: [
          [0.09, 1.01],
          [0.3, 0.5],
          [0.51, 0.0],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 1.06,
      },
      {
        pts: [
          [0.52, 1.01],
          [0.3, 0.5],
          [0.08, 0.0],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.02,
      },
    ],
  },

  Y: {
    width: 0.58,
    strokes: [
      {
        pts: [
          [0.07, 1.01],
          [0.19, 0.74],
          [0.29, 0.48],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 1.02,
        waistInfluence: 0.7,
      },
      {
        pts: [
          [0.52, 1.01],
          [0.4, 0.74],
          [0.29, 0.48],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.0,
        waistInfluence: 0.7,
      },
      {
        pts: [
          [0.29, 0.48],
          [0.29, 0.22],
          [0.28, 0.0],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.06,
        limbDropEnd: 'end',
      },
    ],
  },

  Z: {
    width: 0.56,
    strokes: [
      {
        pts: [
          [0.09, 0.94],
          [0.3, 0.99],
          [0.5, 1.01],
        ],
        piece: 'crossbar-rise',
        taper: 'sharp',
        weightScale: 0.98,
        riseSlope: 0.6,
      },
      {
        pts: [
          [0.49, 1.0],
          [0.29, 0.5],
          [0.08, 0.01],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 1.04,
      },
      {
        pts: [
          [0.08, 0.01],
          [0.29, 0.07],
          [0.51, 0.14],
        ],
        piece: 'foot-kick',
        taper: 'sharp',
        weightScale: 1.02,
        riseSlope: 1.0,
      },
    ],
  },
};

// Lowercase (tall x-height ~0.64 to harmonize with ALMA's condensed display energy!)
const LOWER: Record<string, GlyphBlueprint> = {
  a: {
    width: 0.52,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.12, 0.57],
          [0.28, 0.65],
          [0.42, 0.56],
          [0.43, 0.25],
          [0.44, 0.0],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.02,
        limbDropEnd: 'end',
      },
      {
        pts: [
          [0.42, 0.36],
          [0.24, 0.39],
          [0.09, 0.27],
          [0.1, 0.08],
          [0.24, 0.0],
          [0.42, 0.12],
        ],
        piece: 'curve',
        taper: 'chisel',
        weightScale: 0.94,
        waistInfluence: 0.6,
        isCounter: true,
      },
    ],
  },

  b: {
    width: 0.54,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.11, 0.0],
          [0.11, 0.52],
          [0.12, 1.03],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.06,
      },
      {
        pts: [
          [0.11, 0.45],
          [0.26, 0.63],
          [0.43, 0.56],
          [0.47, 0.31],
          [0.4, 0.07],
          [0.23, 0.01],
          [0.11, 0.14],
        ],
        piece: 'curve',
        taper: 'chisel',
        weightScale: 0.96,
        isCounter: true,
      },
    ],
  },

  c: {
    width: 0.48,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.43, 0.54],
          [0.3, 0.64],
          [0.15, 0.56],
          [0.08, 0.32],
          [0.14, 0.08],
          [0.29, 0.01],
          [0.44, 0.12],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 1.0,
      },
      {
        pts: [
          [0.26, 0.01],
          [0.37, 0.06],
          [0.44, 0.13],
        ],
        piece: 'foot-kick',
        taper: 'sharp',
        weightScale: 0.88,
        riseSlope: 0.7,
      },
    ],
  },

  d: {
    width: 0.54,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.43, 1.03],
          [0.43, 0.5],
          [0.43, 0.0],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.06,
      },
      {
        pts: [
          [0.43, 0.46],
          [0.29, 0.63],
          [0.13, 0.55],
          [0.08, 0.31],
          [0.14, 0.07],
          [0.3, 0.01],
          [0.43, 0.15],
        ],
        piece: 'curve',
        taper: 'chisel',
        weightScale: 0.96,
        isCounter: true,
      },
    ],
  },

  e: {
    width: 0.52,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.09, 0.31],
          [0.28, 0.37],
          [0.45, 0.42],
          [0.42, 0.57],
          [0.27, 0.64],
          [0.12, 0.54],
          [0.08, 0.28],
          [0.14, 0.07],
          [0.29, 0.01],
          [0.44, 0.11],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 0.98,
        isCounter: true,
      },
      {
        pts: [
          [0.09, 0.31],
          [0.28, 0.37],
          [0.45, 0.42],
        ],
        piece: 'crossbar-rise',
        taper: 'chisel',
        weightScale: 0.9,
        waistInfluence: 0.55,
        riseSlope: 0.85,
      },
    ],
  },

  f: {
    width: 0.42,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.17, 0.0],
          [0.17, 0.62],
          [0.21, 0.95],
          [0.34, 1.03],
          [0.4, 0.97],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.02,
        limbDropEnd: 'start',
      },
      {
        pts: [
          [0.05, 0.56],
          [0.22, 0.61],
          [0.38, 0.66],
        ],
        piece: 'crossbar-rise',
        taper: 'sharp',
        weightScale: 0.92,
        waistInfluence: 0.6,
        riseSlope: 0.85,
      },
    ],
  },

  g: {
    width: 0.54,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.43, 0.62],
          [0.43, 0.16],
          [0.39, -0.14],
          [0.25, -0.25],
          [0.1, -0.19],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.04,
        limbDropEnd: 'end',
      },
      {
        pts: [
          [0.43, 0.47],
          [0.29, 0.63],
          [0.13, 0.55],
          [0.08, 0.32],
          [0.14, 0.08],
          [0.29, 0.02],
          [0.43, 0.16],
        ],
        piece: 'curve',
        taper: 'chisel',
        weightScale: 0.96,
        isCounter: true,
      },
    ],
  },

  h: {
    width: 0.54,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.11, 0.0],
          [0.11, 0.54],
          [0.12, 1.03],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.06,
      },
      {
        pts: [
          [0.11, 0.45],
          [0.24, 0.63],
          [0.39, 0.61],
          [0.44, 0.44],
          [0.44, 0.0],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.0,
        limbDropEnd: 'end',
      },
    ],
  },

  i: {
    width: 0.28,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.14, 0.0],
          [0.14, 0.34],
          [0.15, 0.63],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.06,
      },
      {
        pts: [
          [0.14, 0.78],
          [0.17, 0.87],
        ],
        piece: 'diacritic',
        taper: 'chisel',
        weightScale: 0.96,
        isDiacritic: true,
      },
    ],
  },

  j: {
    width: 0.34,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.22, 0.63],
          [0.22, 0.14],
          [0.18, -0.17],
          [0.06, -0.24],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.04,
        limbDropEnd: 'end',
      },
      {
        pts: [
          [0.21, 0.78],
          [0.24, 0.87],
        ],
        piece: 'diacritic',
        taper: 'chisel',
        weightScale: 0.96,
        isDiacritic: true,
      },
    ],
  },

  k: {
    width: 0.52,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.11, 0.0],
          [0.11, 0.54],
          [0.12, 1.03],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.06,
      },
      {
        pts: [
          [0.44, 0.63],
          [0.27, 0.45],
          [0.12, 0.29],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 0.96,
      },
      {
        pts: [
          [0.21, 0.38],
          [0.34, 0.19],
          [0.46, 0.0],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.0,
        limbDropEnd: 'end',
      },
    ],
  },

  l: {
    width: 0.34,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.13, 0.02],
          [0.14, 0.54],
          [0.15, 1.03],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.08,
      },
      {
        pts: [
          [0.13, 0.02],
          [0.23, 0.06],
          [0.3, 0.11],
        ],
        piece: 'foot-kick',
        taper: 'sharp',
        weightScale: 0.88,
        riseSlope: 0.8,
      },
    ],
  },

  m: {
    width: 0.76,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.09, 0.0],
          [0.09, 0.34],
          [0.1, 0.63],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.02,
      },
      {
        pts: [
          [0.1, 0.48],
          [0.21, 0.63],
          [0.35, 0.6],
          [0.39, 0.42],
          [0.39, 0.0],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 0.96,
      },
      {
        pts: [
          [0.39, 0.48],
          [0.51, 0.63],
          [0.64, 0.6],
          [0.68, 0.42],
          [0.68, 0.0],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 0.98,
        limbDropEnd: 'end',
      },
    ],
  },

  n: {
    width: 0.54,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.11, 0.0],
          [0.11, 0.34],
          [0.12, 0.63],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.04,
      },
      {
        pts: [
          [0.12, 0.47],
          [0.25, 0.63],
          [0.39, 0.6],
          [0.44, 0.43],
          [0.44, 0.0],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.0,
        limbDropEnd: 'end',
      },
    ],
  },

  o: {
    width: 0.52,
    isLower: true,
    strokes: [
      {
        pts: arcPts(0.26, 0.32, 0.19, 0.31, 0, 360, 18),
        piece: 'curve',
        taper: 'uniform',
        weightScale: 0.98,
        isCounter: true,
      },
    ],
  },

  p: {
    width: 0.54,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.11, 0.63],
          [0.11, 0.14],
          [0.1, -0.25],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.04,
        limbDropEnd: 'end',
      },
      {
        pts: [
          [0.11, 0.48],
          [0.26, 0.63],
          [0.43, 0.55],
          [0.47, 0.31],
          [0.4, 0.08],
          [0.24, 0.01],
          [0.11, 0.14],
        ],
        piece: 'curve',
        taper: 'chisel',
        weightScale: 0.96,
        isCounter: true,
      },
    ],
  },

  q: {
    width: 0.54,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.43, 0.63],
          [0.43, 0.14],
          [0.44, -0.25],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.04,
        limbDropEnd: 'end',
      },
      {
        pts: [
          [0.43, 0.47],
          [0.28, 0.63],
          [0.12, 0.55],
          [0.08, 0.31],
          [0.15, 0.08],
          [0.3, 0.01],
          [0.43, 0.14],
        ],
        piece: 'curve',
        taper: 'chisel',
        weightScale: 0.96,
        isCounter: true,
      },
    ],
  },

  r: {
    width: 0.42,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.12, 0.0],
          [0.12, 0.34],
          [0.13, 0.63],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.04,
      },
      {
        pts: [
          [0.13, 0.44],
          [0.23, 0.61],
          [0.36, 0.63],
        ],
        piece: 'crossbar-rise',
        taper: 'sharp',
        weightScale: 0.94,
        riseSlope: 0.6,
      },
    ],
  },

  s: {
    width: 0.46,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.4, 0.55],
          [0.28, 0.63],
          [0.14, 0.58],
          [0.09, 0.46],
          [0.17, 0.35],
          [0.34, 0.27],
          [0.41, 0.14],
          [0.31, 0.01],
          [0.15, 0.02],
          [0.07, 0.11],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 0.98,
      },
    ],
  },

  t: {
    width: 0.42,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.17, 0.92],
          [0.17, 0.26],
          [0.2, 0.04],
          [0.35, 0.09],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.02,
      },
      {
        pts: [
          [0.05, 0.57],
          [0.21, 0.62],
          [0.37, 0.67],
        ],
        piece: 'crossbar-rise',
        taper: 'sharp',
        weightScale: 0.92,
        waistInfluence: 0.5,
        riseSlope: 0.85,
      },
    ],
  },

  u: {
    width: 0.54,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.11, 0.63],
          [0.11, 0.18],
          [0.18, 0.02],
          [0.33, 0.04],
          [0.43, 0.2],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.0,
      },
      {
        pts: [
          [0.43, 0.63],
          [0.43, 0.3],
          [0.44, 0.0],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.02,
        limbDropEnd: 'end',
      },
    ],
  },

  v: {
    width: 0.52,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.08, 0.63],
          [0.18, 0.3],
          [0.26, 0.0],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 1.02,
      },
      {
        pts: [
          [0.26, 0.0],
          [0.36, 0.31],
          [0.45, 0.63],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 0.98,
      },
    ],
  },

  w: {
    width: 0.74,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.06, 0.63],
          [0.14, 0.3],
          [0.2, 0.01],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.0,
      },
      {
        pts: [
          [0.2, 0.01],
          [0.3, 0.3],
          [0.37, 0.55],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 0.94,
      },
      {
        pts: [
          [0.37, 0.55],
          [0.46, 0.28],
          [0.54, 0.01],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 0.94,
      },
      {
        pts: [
          [0.54, 0.01],
          [0.62, 0.32],
          [0.69, 0.63],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.0,
      },
    ],
  },

  x: {
    width: 0.52,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.09, 0.63],
          [0.26, 0.31],
          [0.44, 0.0],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 1.02,
      },
      {
        pts: [
          [0.44, 0.63],
          [0.26, 0.31],
          [0.08, 0.0],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 0.98,
      },
    ],
  },

  y: {
    width: 0.52,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.09, 0.63],
          [0.18, 0.31],
          [0.26, 0.04],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 1.0,
      },
      {
        pts: [
          [0.45, 0.63],
          [0.3, 0.16],
          [0.18, -0.18],
          [0.09, -0.25],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.02,
        limbDropEnd: 'end',
      },
    ],
  },

  z: {
    width: 0.48,
    isLower: true,
    strokes: [
      {
        pts: [
          [0.09, 0.58],
          [0.26, 0.62],
          [0.42, 0.64],
        ],
        piece: 'crossbar-rise',
        taper: 'sharp',
        weightScale: 0.94,
        riseSlope: 0.6,
      },
      {
        pts: [
          [0.42, 0.63],
          [0.25, 0.31],
          [0.08, 0.01],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 1.0,
      },
      {
        pts: [
          [0.08, 0.01],
          [0.25, 0.06],
          [0.43, 0.12],
        ],
        piece: 'foot-kick',
        taper: 'sharp',
        weightScale: 0.98,
        riseSlope: 0.9,
      },
    ],
  },
};

// Hungarian Accented Uppercase & Lowercase
const HUNGARIAN: Record<string, GlyphBlueprint> = {
  Á: withDiacritic(UPPER.A, acuteAccent(0.35, 1.06)),
  É: withDiacritic(UPPER.E, acuteAccent(0.29, 1.06)),
  Í: withDiacritic(UPPER.I, acuteAccent(0.16, 1.06)),
  Ó: withDiacritic(UPPER.O, acuteAccent(0.31, 1.05)),
  Ö: withDiacritic(UPPER.O, diaeresisAccent(0.3, 1.05)),
  Ő: withDiacritic(UPPER.O, doubleAcuteAccent(0.31, 1.05)),
  Ú: withDiacritic(UPPER.U, acuteAccent(0.31, 1.06)),
  Ü: withDiacritic(UPPER.U, diaeresisAccent(0.3, 1.06)),
  Ű: withDiacritic(UPPER.U, doubleAcuteAccent(0.31, 1.06)),

  á: withDiacritic(LOWER.a, acuteAccent(0.28, 0.72)),
  é: withDiacritic(LOWER.e, acuteAccent(0.27, 0.72)),
  í: {
    width: 0.28,
    isLower: true,
    strokes: [LOWER.i.strokes[0], ...acuteAccent(0.15, 0.72)],
  },
  ó: withDiacritic(LOWER.o, acuteAccent(0.27, 0.71)),
  ö: withDiacritic(LOWER.o, diaeresisAccent(0.26, 0.71)),
  ő: withDiacritic(LOWER.o, doubleAcuteAccent(0.27, 0.71)),
  ú: withDiacritic(LOWER.u, acuteAccent(0.28, 0.72)),
  ü: withDiacritic(LOWER.u, diaeresisAccent(0.27, 0.72)),
  ű: withDiacritic(LOWER.u, doubleAcuteAccent(0.28, 0.72)),
};

const DIGITS: Record<string, GlyphBlueprint> = {
  '0': {
    width: 0.56,
    strokes: [
      {
        pts: arcPts(0.28, 0.5, 0.19, 0.49, 0, 360, 20),
        piece: 'curve',
        taper: 'uniform',
        weightScale: 1.0,
        isCounter: true,
      },
      {
        pts: [
          [0.16, 0.2],
          [0.4, 0.8],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 0.72,
      },
    ],
  },
  '1': {
    width: 0.42,
    strokes: [
      {
        pts: [
          [0.24, 0.0],
          [0.24, 0.52],
          [0.25, 1.01],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.08,
      },
      {
        pts: [
          [0.09, 0.79],
          [0.18, 0.9],
          [0.25, 1.01],
        ],
        piece: 'apex-spike',
        taper: 'sharp',
        weightScale: 0.94,
      },
    ],
  },
  '2': {
    width: 0.54,
    strokes: [
      {
        pts: [
          [0.1, 0.82],
          [0.23, 0.99],
          [0.41, 0.97],
          [0.48, 0.78],
          [0.37, 0.51],
          [0.08, 0.02],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 1.02,
      },
      {
        pts: [
          [0.08, 0.02],
          [0.29, 0.08],
          [0.5, 0.16],
        ],
        piece: 'foot-kick',
        taper: 'sharp',
        weightScale: 1.04,
        riseSlope: 1.0,
      },
    ],
  },
  '3': {
    width: 0.54,
    strokes: [
      {
        pts: [
          [0.11, 0.88],
          [0.28, 1.0],
          [0.46, 0.89],
          [0.45, 0.67],
          [0.26, 0.54],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 0.98,
        waistInfluence: 0.6,
      },
      {
        pts: [
          [0.24, 0.54],
          [0.47, 0.43],
          [0.49, 0.18],
          [0.34, 0.01],
          [0.14, 0.04],
          [0.08, 0.15],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 1.02,
        waistInfluence: 0.5,
      },
    ],
  },
  '4': {
    width: 0.58,
    strokes: [
      {
        pts: [
          [0.42, 0.0],
          [0.42, 0.52],
          [0.43, 1.01],
        ],
        piece: 'stem-right',
        taper: 'sharp',
        weightScale: 1.06,
        limbDropEnd: 'start',
      },
      {
        pts: [
          [0.42, 1.0],
          [0.23, 0.66],
          [0.07, 0.34],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 0.98,
      },
      {
        pts: [
          [0.07, 0.34],
          [0.31, 0.41],
          [0.53, 0.46],
        ],
        piece: 'crossbar-rise',
        taper: 'chisel',
        weightScale: 0.98,
        waistInfluence: 0.85,
        riseSlope: 0.85,
        isCounter: true,
      },
    ],
  },
  '5': {
    width: 0.54,
    strokes: [
      {
        pts: [
          [0.47, 0.99],
          [0.28, 0.97],
          [0.14, 0.95],
          [0.12, 0.54],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.0,
      },
      {
        pts: [
          [0.12, 0.54],
          [0.33, 0.59],
          [0.48, 0.42],
          [0.46, 0.16],
          [0.31, 0.01],
          [0.13, 0.04],
          [0.08, 0.14],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 1.02,
        waistInfluence: 0.5,
      },
    ],
  },
  '6': {
    width: 0.54,
    strokes: [
      {
        pts: [
          [0.43, 0.99],
          [0.22, 0.82],
          [0.1, 0.47],
          [0.12, 0.15],
          [0.28, 0.01],
          [0.46, 0.12],
          [0.48, 0.36],
          [0.34, 0.52],
          [0.14, 0.44],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 1.02,
        isCounter: true,
      },
    ],
  },
  '7': {
    width: 0.52,
    strokes: [
      {
        pts: [
          [0.07, 0.93],
          [0.29, 0.98],
          [0.48, 1.01],
        ],
        piece: 'crossbar-rise',
        taper: 'chisel',
        weightScale: 1.02,
        riseSlope: 0.45,
      },
      {
        pts: [
          [0.47, 1.02],
          [0.32, 0.5],
          [0.17, 0.0],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 1.06,
        limbDropEnd: 'end',
      },
    ],
  },
  '8': {
    width: 0.54,
    strokes: [
      {
        pts: arcPts(0.27, 0.75, 0.17, 0.24, 0, 360, 16),
        piece: 'curve',
        taper: 'uniform',
        weightScale: 0.94,
        isCounter: true,
      },
      {
        pts: arcPts(0.27, 0.27, 0.2, 0.26, 0, 360, 16),
        piece: 'curve',
        taper: 'uniform',
        weightScale: 1.0,
        isCounter: true,
      },
    ],
  },
  '9': {
    width: 0.54,
    strokes: [
      {
        pts: [
          [0.44, 0.58],
          [0.3, 0.5],
          [0.12, 0.62],
          [0.11, 0.86],
          [0.26, 0.99],
          [0.44, 0.87],
          [0.46, 0.52],
          [0.36, 0.18],
          [0.16, 0.01],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 1.02,
        isCounter: true,
      },
    ],
  },
};

const PUNCT: Record<string, GlyphBlueprint> = {
  ' ': { width: 0.34, strokes: [] },
  '.': {
    width: 0.24,
    strokes: [
      {
        pts: [
          [0.11, 0.02],
          [0.13, 0.11],
        ],
        piece: 'diacritic',
        taper: 'chisel',
        weightScale: 1.1,
      },
    ],
  },
  ',': {
    width: 0.24,
    strokes: [
      {
        pts: [
          [0.14, 0.12],
          [0.09, -0.09],
        ],
        piece: 'diacritic',
        taper: 'sharp',
        weightScale: 0.96,
      },
    ],
  },
  '!': {
    width: 0.28,
    strokes: [
      {
        pts: [
          [0.14, 0.28],
          [0.14, 0.68],
          [0.16, 1.02],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 1.08,
      },
      {
        pts: [
          [0.13, 0.02],
          [0.15, 0.11],
        ],
        piece: 'diacritic',
        taper: 'chisel',
        weightScale: 1.06,
        isDiacritic: true,
      },
    ],
  },
  '?': {
    width: 0.48,
    strokes: [
      {
        pts: [
          [0.11, 0.84],
          [0.24, 1.0],
          [0.4, 0.93],
          [0.42, 0.72],
          [0.24, 0.52],
          [0.23, 0.3],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 1.0,
      },
      {
        pts: [
          [0.22, 0.02],
          [0.24, 0.11],
        ],
        piece: 'diacritic',
        taper: 'chisel',
        weightScale: 1.04,
        isDiacritic: true,
      },
    ],
  },
  '-': {
    width: 0.42,
    strokes: [
      {
        pts: [
          [0.08, 0.42],
          [0.34, 0.47],
        ],
        piece: 'crossbar-rise',
        taper: 'sharp',
        weightScale: 0.95,
        riseSlope: 0.7,
      },
    ],
  },
  ':': {
    width: 0.24,
    strokes: [
      {
        pts: [
          [0.12, 0.52],
          [0.14, 0.61],
        ],
        piece: 'diacritic',
        taper: 'chisel',
        weightScale: 1.0,
        isDiacritic: true,
      },
      {
        pts: [
          [0.11, 0.04],
          [0.13, 0.13],
        ],
        piece: 'diacritic',
        taper: 'chisel',
        weightScale: 1.0,
        isDiacritic: true,
      },
    ],
  },
  '/': {
    width: 0.44,
    strokes: [
      {
        pts: [
          [0.08, -0.06],
          [0.37, 1.04],
        ],
        piece: 'diag-plunge',
        taper: 'sharp',
        weightScale: 0.98,
      },
    ],
  },
  '·': {
    width: 0.26,
    strokes: [
      {
        pts: [
          [0.12, 0.44],
          [0.14, 0.52],
        ],
        piece: 'diacritic',
        taper: 'chisel',
        weightScale: 1.15,
      },
    ],
  },
  '(': {
    width: 0.34,
    strokes: [
      {
        pts: [
          [0.27, 1.02],
          [0.14, 0.72],
          [0.11, 0.44],
          [0.16, 0.14],
          [0.28, -0.14],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 0.96,
      },
    ],
  },
  ')': {
    width: 0.34,
    strokes: [
      {
        pts: [
          [0.08, 1.02],
          [0.21, 0.72],
          [0.24, 0.44],
          [0.19, 0.14],
          [0.07, -0.14],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 0.96,
      },
    ],
  },
  '+': {
    width: 0.48,
    strokes: [
      {
        pts: [
          [0.24, 0.24],
          [0.24, 0.72],
        ],
        piece: 'stem-left',
        taper: 'sharp',
        weightScale: 0.94,
      },
      {
        pts: [
          [0.06, 0.44],
          [0.42, 0.51],
        ],
        piece: 'crossbar-rise',
        taper: 'sharp',
        weightScale: 0.94,
        riseSlope: 0.5,
      },
    ],
  },
  '&': {
    width: 0.62,
    strokes: [
      {
        pts: [
          [0.54, 0.04],
          [0.34, 0.34],
          [0.16, 0.66],
          [0.22, 0.93],
          [0.36, 0.97],
          [0.44, 0.82],
          [0.32, 0.57],
          [0.12, 0.34],
          [0.09, 0.12],
          [0.24, 0.01],
          [0.43, 0.14],
          [0.54, 0.38],
        ],
        piece: 'curve',
        taper: 'sharp',
        weightScale: 0.96,
        isCounter: true,
      },
    ],
  },
};

export const GLYPH_BLUEPRINTS: Record<string, GlyphBlueprint> = {
  ...UPPER,
  ...HUNGARIAN,
  ...LOWER,
  ...DIGITS,
  ...PUNCT,
};

export const CHARACTER_GROUPS = [
  {
    id: 'upper',
    label: 'Nagybetűk (A–Z + Magyar)',
    chars: [
      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      ...'ÁÉÍÓÖŐÚÜŰ',
    ],
  },
  {
    id: 'lower',
    label: 'Kisbetűk (a–z + Magyar)',
    chars: [
      ...'abcdefghijklmnopqrstuvwxyz',
      ...'áéíóöőúüű',
    ],
  },
  {
    id: 'digits',
    label: 'Számok & Írásjelek',
    chars: [...'0123456789.,!?-:/·()+&'],
  },
];

export const ALL_SUPPORTED_CHARS: string[] = [
  ' ',
  ...CHARACTER_GROUPS.flatMap((g) => g.chars),
];
