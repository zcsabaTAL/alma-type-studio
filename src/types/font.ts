export type PieceId =
  | 'stem-left'
  | 'stem-right'
  | 'crossbar-rise'
  | 'foot-kick'
  | 'apex-spike'
  | 'diag-plunge';

export interface ExtractedPiece {
  id: PieceId;
  label: string;
  sourceRef: string;
  description: string;
  previewPath: string;
}

export interface ConstructionParams {
  pieceVariation: number; // 0..100
  exaggeration: number; // 0..100
  jointMelt: number; // 0..100
  counterPinch: number; // 0..100
  limbDrop: number; // -40..100
  baselineBounce: number; // 0..100
  waistHeight: number; // 20..80
  strokeWeight: number; // 18..76
  activePieces: Record<PieceId, boolean>;
}

export interface TypesettingParams {
  fontSize: number; // 36..220
  lineHeight: number; // 0.85..2.0
  letterSpacing: number; // -40..120
  renderMode: 'solid' | 'outline';
  showMetrics: boolean;
  canvasTheme: 'dark' | 'postit' | 'paper';
}

export interface BezierPoint {
  x: number;
  y: number;
  inX: number;
  inY: number;
  outX: number;
  outY: number;
  smooth: boolean;
}

export interface BezierContour {
  points: BezierPoint[];
  isHole: boolean;
}

export interface GlyphData {
  char: string;
  unicode: number;
  advanceWidth: number;
  contours: BezierContour[];
  isManualOverride: boolean;
}

export interface SketchAnalysisResult {
  imageUrl: string;
  fileName: string;
  inkCoverage: number;
  estimatedSlantDeg: number;
  aspectRatio: number;
  strokeDensity: number;
  tracePreviewDataUrl: string;
}

export type ActiveTab = 'studio' | 'glyphs' | 'test' | 'cards';
export type FontFamilyWeight = 'regular' | 'bold' | 'molten';
