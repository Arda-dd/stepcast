import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { clamp, rectFromPoints } from '../core/demo';
import type { Point, Rect, Step } from '../core/types';
import { useImageUrl } from './lib';

export type Tool = 'hotspot' | 'blur';

interface Props {
  step: Step;
  tool: Tool;
  color: string;
  selectedBlur: number | null;
  onSelectBlur: (index: number | null) => void;
  onChange: (patch: Partial<Step>) => void;
}

/** The part of the screenshot that stays visible when the player zooms into the hotspot. */
export function zoomViewport(hotspot: Point, zoom: number): Rect {
  return { x: hotspot.x - hotspot.x / zoom, y: hotspot.y - hotspot.y / zoom, w: 1 / zoom, h: 1 / zoom };
}

const pct = (n: number) => `${n * 100}%`;

/**
 * CSS for showing the part of the screenshot under `rect`, filling the rect. Blurred, it previews a hidden area
 * (backdrop-filter is not reliable everywhere, a filtered copy of the image is).
 */
export function cropStyle(url: string, rect: { x: number; y: number; w: number; h: number }) {
  const position = (offset: number, size: number) => (size >= 1 ? 0 : (offset / (1 - size)) * 100);
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: `${100 / Math.max(rect.w, 0.0001)}% ${100 / Math.max(rect.h, 0.0001)}%`,
    backgroundPosition: `${position(rect.x, rect.w)}% ${position(rect.y, rect.h)}%`,
  };
}

export function Canvas({ step, tool, color, selectedBlur, onSelectBlur, onChange }: Props) {
  const url = useImageUrl(step.imageId);
  const frame = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ start: Point; end: Point } | null>(null);
  const [draggingHotspot, setDraggingHotspot] = useState(false);

  const toPoint = (e: { clientX: number; clientY: number }): Point => {
    const box = frame.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - box.left) / box.width), y: clamp((e.clientY - box.top) / box.height) };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    frame.current!.setPointerCapture(e.pointerId);
    const p = toPoint(e);
    onSelectBlur(null);
    if (tool === 'hotspot') {
      onChange({ hotspot: p });
      setDraggingHotspot(true);
    } else {
      setDraft({ start: p, end: p });
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingHotspot) onChange({ hotspot: toPoint(e) });
    else if (draft) setDraft({ ...draft, end: toPoint(e) });
  };

  const onPointerUp = () => {
    setDraggingHotspot(false);
    if (draft) {
      const rect = rectFromPoints(draft.start, draft.end);
      if (rect.w > 0.005 && rect.h > 0.005) {
        onChange({ blurs: [...step.blurs, rect] });
        onSelectBlur(step.blurs.length);
      }
      setDraft(null);
    }
  };

  const hotspot = step.hotspot;
  const view = hotspot && step.zoom > 1 ? zoomViewport(hotspot, step.zoom) : null;
  const draftRect = draft ? rectFromPoints(draft.start, draft.end) : null;

  return (
    <div className="canvas-area">
      <div
        ref={frame}
        className={`canvas-frame tool-${tool}`}
        style={{ ['--ratio' as string]: `${step.width} / ${step.height}`, ['--marker' as string]: color }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={tool === 'hotspot' ? 'Screenshot: click to place the hotspot' : 'Screenshot: drag to hide an area'}
      >
        {url && <img src={url} alt="" draggable={false} />}

        {view && <div className="zoom-view" style={{ left: pct(view.x), top: pct(view.y), width: pct(view.w), height: pct(view.h) }} />}

        {step.blurs.map((b, i) => (
          <div
            key={i}
            className={`blur-box ${selectedBlur === i ? 'selected' : ''}`}
            style={{ left: pct(b.x), top: pct(b.y), width: pct(b.w), height: pct(b.h) }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelectBlur(i);
            }}
          >
            {url && <div className="blur-fill" style={cropStyle(url, b)} />}
            {selectedBlur === i && (
              <button
                className="remove"
                aria-label="Remove hidden area"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  onChange({ blurs: step.blurs.filter((_, j) => j !== i) });
                  onSelectBlur(null);
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {draftRect && (
          <div className="blur-box drawing" style={{ left: pct(draftRect.x), top: pct(draftRect.y), width: pct(draftRect.w), height: pct(draftRect.h) }} />
        )}

        {hotspot && <div className="marker" style={{ left: pct(hotspot.x), top: pct(hotspot.y) }} />}
        {step.tooltip && (
          <div
            className={`bubble ${!hotspot ? 'card' : hotspot.y >= 0.6 ? 'above' : ''}`}
            style={hotspot ? { left: pct(clamp(hotspot.x, 0.15, 0.85)), top: pct(hotspot.y) } : undefined}
          >
            {step.tooltip}
          </div>
        )}
      </div>
    </div>
  );
}
