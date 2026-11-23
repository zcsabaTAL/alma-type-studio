import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CornerUpLeft,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { BezierContour, BezierPoint, GlyphData } from '../types/font';
import {
  ASCENDER,
  CAP_HEIGHT,
  DESCENDER,
  glyphToSvgPath,
} from '../engine/sdfVectorizer';

interface BezierEditorProps {
  char: string;
  glyph: GlyphData;
  proceduralGlyph: GlyphData;
  onSaveOverride: (char: string, updated: GlyphData) => void;
  onResetOverride: (char: string) => void;
  onBack: () => void;
}

type DragTarget =
  | { type: 'anchor'; cIdx: number; pIdx: number }
  | { type: 'in'; cIdx: number; pIdx: number }
  | { type: 'out'; cIdx: number; pIdx: number }
  | null;

function cloneContours(contours: BezierContour[]): BezierContour[] {
  return contours.map((c) => ({
    isHole: c.isHole,
    points: c.points.map((p) => ({ ...p })),
  }));
}

// De Casteljau split at t = 0.5 for adding a new Bezier point along a curve segment
function splitCubicMidpoint(p0: BezierPoint, p1: BezierPoint) {
  const x0 = p0.x,
    y0 = p0.y;
  const x1 = p0.outX,
    y1 = p0.outY;
  const x2 = p1.inX,
    y2 = p1.inY;
  const x3 = p1.x,
    y3 = p1.y;

  const x01 = (x0 + x1) * 0.5,
    y01 = (y0 + y1) * 0.5;
  const x12 = (x1 + x2) * 0.5,
    y12 = (y1 + y2) * 0.5;
  const x23 = (x2 + x3) * 0.5,
    y23 = (y2 + y3) * 0.5;

  const x012 = (x01 + x12) * 0.5,
    y012 = (y01 + y12) * 0.5;
  const x123 = (x12 + x23) * 0.5,
    y123 = (y12 + y23) * 0.5;

  const xm = (x012 + x123) * 0.5,
    ym = (y012 + y123) * 0.5;

  const updatedP0: BezierPoint = { ...p0, outX: x01, outY: y01 };
  const midPoint: BezierPoint = {
    x: xm,
    y: ym,
    inX: x012,
    inY: y012,
    outX: x123,
    outY: y123,
    smooth: true,
  };
  const updatedP1: BezierPoint = { ...p1, inX: x23, inY: y23 };

  return { updatedP0, midPoint, updatedP1 };
}

export const BezierEditor: React.FC<BezierEditorProps> = ({
  char,
  glyph,
  proceduralGlyph,
  onSaveOverride,
  onResetOverride,
  onBack,
}) => {
  const [contours, setContours] = useState<BezierContour[]>(() =>
    cloneContours(glyph.contours)
  );
  const [history, setHistory] = useState<BezierContour[][]>([]);
  const [selected, setSelected] = useState<{ cIdx: number; pIdx: number } | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [showGhost, setShowGhost] = useState(true);
  const [showFill, setShowFill] = useState(true);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Sync when switching character or resetting
  useEffect(() => {
    setContours(cloneContours(glyph.contours));
    setHistory([]);
    setSelected(null);
  }, [char, glyph]);

  const viewMinX = -160;
  const viewWidth = Math.max(920, glyph.advanceWidth + 320);
  const viewMinY = -120;
  const viewHeight = ASCENDER - DESCENDER + 240;

  const commitContours = useCallback(
    (next: BezierContour[], pushUndo = false) => {
      if (pushUndo) {
        setHistory((h) => [...h.slice(-24), cloneContours(contours)]);
      }
      setContours(next);
      onSaveOverride(char, {
        ...glyph,
        contours: next,
        isManualOverride: true,
      });
    },
    [char, contours, glyph, onSaveOverride]
  );

  const clientToGlyphCoords = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;

      // PreserveAspectRatio xMidYMid meet mapping
      const scale = Math.min(rect.width / viewWidth, rect.height / viewHeight);
      const renderedW = viewWidth * scale;
      const renderedH = viewHeight * scale;
      const offsetX = rect.left + (rect.width - renderedW) * 0.5;
      const offsetY = rect.top + (rect.height - renderedH) * 0.5;

      const svgX = viewMinX + (clientX - offsetX) / scale;
      const svgY = viewMinY + (clientY - offsetY) / scale;
      // Convert SVG Y-down back to Y-up typographic units
      return [Math.round(svgX * 10) / 10, Math.round((ASCENDER - svgY) * 10) / 10];
    },
    [viewHeight, viewMinX, viewMinY, viewWidth]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragTarget) return;
      const pt = clientToGlyphCoords(e.clientX, e.clientY);
      if (!pt) return;
      const [gx, gy] = pt;

      setContours((prev) => {
        const next = cloneContours(prev);
        const node = next[dragTarget.cIdx]?.points[dragTarget.pIdx];
        if (!node) return prev;

        if (dragTarget.type === 'anchor') {
          const dx = gx - node.x;
          const dy = gy - node.y;
          node.x = gx;
          node.y = gy;
          node.inX += dx;
          node.inY += dy;
          node.outX += dx;
          node.outY += dy;
        } else if (dragTarget.type === 'in') {
          node.inX = gx;
          node.inY = gy;
          if (node.smooth && !e.altKey) {
            const vx = node.x - gx;
            const vy = node.y - gy;
            const len = Math.hypot(vx, vy) || 1;
            const oppLen = Math.hypot(node.outX - node.x, node.outY - node.y);
            node.outX = node.x + (vx / len) * oppLen;
            node.outY = node.y + (vy / len) * oppLen;
          }
        } else if (dragTarget.type === 'out') {
          node.outX = gx;
          node.outY = gy;
          if (node.smooth && !e.altKey) {
            const vx = node.x - gx;
            const vy = node.y - gy;
            const len = Math.hypot(vx, vy) || 1;
            const oppLen = Math.hypot(node.inX - node.x, node.inY - node.y);
            node.inX = node.x + (vx / len) * oppLen;
            node.inY = node.y + (vy / len) * oppLen;
          }
        }
        return next;
      });
    },
    [clientToGlyphCoords, dragTarget]
  );

  const handlePointerUp = useCallback(() => {
    if (!dragTarget) return;
    setDragTarget(null);
    onSaveOverride(char, {
      ...glyph,
      contours: cloneContours(contours),
      isManualOverride: true,
    });
  }, [char, contours, dragTarget, glyph, onSaveOverride]);

  const startDrag = (
    e: React.PointerEvent,
    target: NonNullable<DragTarget>
  ) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setHistory((h) => [...h.slice(-24), cloneContours(contours)]);
    setSelected({ cIdx: target.cIdx, pIdx: target.pIdx });
    setDragTarget(target);
  };

  const handleToggleSmooth = () => {
    if (!selected) return;
    const next = cloneContours(contours);
    const node = next[selected.cIdx]?.points[selected.pIdx];
    if (!node) return;
    node.smooth = !node.smooth;
    if (node.smooth) {
      // Align handles cleanly
      const vx = node.outX - node.inX;
      const vy = node.outY - node.inY;
      const len = Math.hypot(vx, vy) || 1;
      const dIn = Math.max(18, Math.hypot(node.inX - node.x, node.inY - node.y));
      const dOut = Math.max(18, Math.hypot(node.outX - node.x, node.outY - node.y));
      node.inX = node.x - (vx / len) * dIn;
      node.inY = node.y - (vy / len) * dIn;
      node.outX = node.x + (vx / len) * dOut;
      node.outY = node.y + (vy / len) * dOut;
    }
    commitContours(next, true);
  };

  const handleAddPointAfterSelected = () => {
    if (!selected) return;
    const next = cloneContours(contours);
    const contour = next[selected.cIdx];
    if (!contour || contour.points.length < 2) return;
    const i0 = selected.pIdx;
    const i1 = (i0 + 1) % contour.points.length;
    const { updatedP0, midPoint, updatedP1 } = splitCubicMidpoint(
      contour.points[i0],
      contour.points[i1]
    );
    contour.points[i0] = updatedP0;
    contour.points[i1] = updatedP1;
    contour.points.splice(i0 + 1, 0, midPoint);
    commitContours(next, true);
    setSelected({ cIdx: selected.cIdx, pIdx: i0 + 1 });
  };

  const handleDeleteSelected = useCallback(() => {
    if (!selected) return;
    const next = cloneContours(contours);
    const contour = next[selected.cIdx];
    if (!contour || contour.points.length <= 3) return;
    contour.points.splice(selected.pIdx, 1);
    commitContours(next, true);
    setSelected(null);
  }, [commitContours, contours, selected]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setContours(prev);
    onSaveOverride(char, {
      ...glyph,
      contours: prev,
      isManualOverride: true,
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA'
        ) {
          return;
        }
        e.preventDefault();
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDeleteSelected, selected]);

  const livePath = useMemo(() => glyphToSvgPath(contours, ASCENDER), [contours]);
  const ghostPath = useMemo(
    () => glyphToSvgPath(proceduralGlyph.contours, ASCENDER),
    [proceduralGlyph]
  );

  const selectedNode =
    selected ? contours[selected.cIdx]?.points[selected.pIdx] ?? null : null;

  const totalNodes = contours.reduce((acc, c) => acc + c.points.length, 0);

  return (
    <div className="bezier-editor-shell">
      <div className="bezier-toolbar">
        <div className="bezier-toolbar-left">
          <button type="button" className="icon-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            Vissza a karaktertáblához
          </button>
          <div className="glyph-title-badge">
            <span className="glyph-title-char">{char}</span>
            <span className="glyph-title-meta">
              U+{glyph.unicode.toString(16).toUpperCase().padStart(4, '0')} ·{' '}
              {contours.length} kontúr · {totalNodes} csomópont
            </span>
          </div>
        </div>

        <div className="bezier-toolbar-actions">
          <button
            type="button"
            className={`pill-btn ${showFill ? 'is-active' : ''}`}
            onClick={() => setShowFill((v) => !v)}
          >
            Kitöltés
          </button>
          <button
            type="button"
            className={`pill-btn ${showGhost ? 'is-active' : ''}`}
            onClick={() => setShowGhost((v) => !v)}
          >
            Eredeti szellem
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={!selected}
            onClick={handleToggleSmooth}
            title="Sima / éles sarok váltása (Alt húzásnál megtöri a karokat)"
          >
            <Sparkles size={14} />
            {selectedNode?.smooth ? 'Sima -> Sarok' : 'Sarok -> Sima'}
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={!selected}
            onClick={handleAddPointAfterSelected}
            title="Új pont beszúrása a következő szakasz felezőpontjába"
          >
            <Plus size={14} />
            Pont +
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={!selected}
            onClick={handleDeleteSelected}
            title="Kijelölt csomópont törlése (Delete)"
          >
            <Trash2 size={14} />
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={history.length === 0}
            onClick={handleUndo}
            title="Visszavonás"
          >
            <CornerUpLeft size={14} />
          </button>
          <button
            type="button"
            className="icon-btn danger"
            onClick={() => onResetOverride(char)}
            title="Visszaállítás procedurális alapra"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </div>

      <div className="bezier-stage">
        <svg
          ref={svgRef}
          className="bezier-svg"
          viewBox={`${viewMinX} ${viewMinY} ${viewWidth} ${viewHeight}`}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={() => setSelected(null)}
        >
          {/* Metric guidelines */}
          <g className="editor-guides">
            {[
              { label: 'ASC 960', y: 0 },
              { label: 'CAP 740', y: ASCENDER - CAP_HEIGHT },
              { label: 'X 480', y: ASCENDER - 480 },
              { label: 'BASE 0', y: ASCENDER },
              { label: 'DESC -240', y: ASCENDER - DESCENDER },
            ].map((g) => (
              <g key={g.label}>
                <line
                  x1={viewMinX}
                  x2={viewMinX + viewWidth}
                  y1={g.y}
                  y2={g.y}
                  stroke={g.label === 'BASE 0' ? 'rgba(255,110,84,0.45)' : 'rgba(255,255,255,0.12)'}
                  strokeDasharray={g.label === 'BASE 0' ? undefined : '6 6'}
                  strokeWidth={2}
                />
                <text
                  x={viewMinX + 18}
                  y={g.y - 10}
                  fill="rgba(255,255,255,0.38)"
                  fontSize="24"
                  fontFamily="ui-monospace, monospace"
                >
                  {g.label}
                </text>
              </g>
            ))}

            {/* Left & Advance Width boundaries */}
            <line
              x1={0}
              x2={0}
              y1={viewMinY}
              y2={viewMinY + viewHeight}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={2}
            />
            <line
              x1={glyph.advanceWidth}
              x2={glyph.advanceWidth}
              y1={viewMinY}
              y2={viewMinY + viewHeight}
              stroke="rgba(110,200,255,0.28)"
              strokeDasharray="8 6"
              strokeWidth={2}
            />
          </g>

          {/* Ghost procedural path */}
          {showGhost && (
            <path
              d={ghostPath}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth={4}
              strokeDasharray="10 8"
            />
          )}

          {/* Live Editable Glyph Path */}
          <path
            d={livePath}
            fill={showFill ? 'rgba(245, 242, 235, 0.24)' : 'none'}
            fillRule="nonzero"
            stroke="#f5f2eb"
            strokeWidth={5}
            strokeLinejoin="round"
          />

          {/* Bezier Control Handles and Anchors */}
          {contours.map((contour, cIdx) =>
            contour.points.map((pt, pIdx) => {
              const isSelected = selected?.cIdx === cIdx && selected?.pIdx === pIdx;
              const ax = pt.x;
              const ay = ASCENDER - pt.y;
              const inX = pt.inX;
              const inY = ASCENDER - pt.inY;
              const outX = pt.outX;
              const outY = ASCENDER - pt.outY;

              return (
                <g key={`${cIdx}-${pIdx}`}>
                  {/* Tangent arms (always show for selected or smooth points nearby) */}
                  <line
                    x1={ax}
                    y1={ay}
                    x2={inX}
                    y2={inY}
                    stroke={isSelected ? '#ff7a59' : 'rgba(130, 200, 255, 0.45)'}
                    strokeWidth={isSelected ? 3.5 : 2}
                  />
                  <line
                    x1={ax}
                    y1={ay}
                    x2={outX}
                    y2={outY}
                    stroke={isSelected ? '#ff7a59' : 'rgba(130, 200, 255, 0.45)'}
                    strokeWidth={isSelected ? 3.5 : 2}
                  />

                  {/* Incoming handle */}
                  <circle
                    cx={inX}
                    cy={inY}
                    r={isSelected ? 11 : 7.5}
                    fill={isSelected ? '#ff7a59' : '#6ec6ff'}
                    stroke="#101116"
                    strokeWidth={2.5}
                    className="bezier-handle"
                    onPointerDown={(e) => startDrag(e, { type: 'in', cIdx, pIdx })}
                    onClick={(e) => e.stopPropagation()}
                  />

                  {/* Outgoing handle */}
                  <circle
                    cx={outX}
                    cy={outY}
                    r={isSelected ? 11 : 7.5}
                    fill={isSelected ? '#ff7a59' : '#6ec6ff'}
                    stroke="#101116"
                    strokeWidth={2.5}
                    className="bezier-handle"
                    onPointerDown={(e) => startDrag(e, { type: 'out', cIdx, pIdx })}
                    onClick={(e) => e.stopPropagation()}
                  />

                  {/* Anchor point (square for corner, circle for smooth) */}
                  {pt.smooth ? (
                    <circle
                      cx={ax}
                      cy={ay}
                      r={isSelected ? 14 : 10}
                      fill={isSelected ? '#ff6e54' : contour.isHole ? '#ffd166' : '#ffffff'}
                      stroke="#101116"
                      strokeWidth={3}
                      className="bezier-anchor"
                      onPointerDown={(e) => startDrag(e, { type: 'anchor', cIdx, pIdx })}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelected({ cIdx, pIdx });
                        handleToggleSmooth();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected({ cIdx, pIdx });
                      }}
                    />
                  ) : (
                    <rect
                      x={ax - (isSelected ? 12 : 9)}
                      y={ay - (isSelected ? 12 : 9)}
                      width={isSelected ? 24 : 18}
                      height={isSelected ? 24 : 18}
                      fill={isSelected ? '#ff6e54' : contour.isHole ? '#ffd166' : '#ffffff'}
                      stroke="#101116"
                      strokeWidth={3}
                      className="bezier-anchor"
                      onPointerDown={(e) => startDrag(e, { type: 'anchor', cIdx, pIdx })}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelected({ cIdx, pIdx });
                        handleToggleSmooth();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected({ cIdx, pIdx });
                      }}
                    />
                  )}
                </g>
              );
            })
          )}
        </svg>
      </div>

      <div className="bezier-footer-hint">
        Húzd a fehér/sárga csomópontokat vagy a kék érintőkarokat · Dupla kattintás: sima/éles csomópont · Alt+húzás: aszimmetrikus érintőkar · A módosítás közvetlenül belekerül a .ttf exportba.
      </div>
    </div>
  );
};
