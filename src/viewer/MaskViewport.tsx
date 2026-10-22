import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import type { DemoItem, Instance, RenderOptions, ViewTransform } from '../domain/types';
import { drawScene, zoomView } from './render';
export function MaskViewport({
  input,
  instances,
  options,
  setView,
  label,
  onSelect,
}: {
  input: DemoItem;
  instances: Instance[];
  options: RenderOptions;
  setView: Dispatch<SetStateAction<ViewTransform>>;
  label: string;
  onSelect?: (id: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const paint = () => {
      const size = Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 2));
      if (!size) return;
      canvas.width = size;
      canvas.height = size;
      drawScene(canvas.getContext('2d')!, size, size, input, instances, options);
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [input, instances, options]);
  useEffect(() => {
    const canvas = ref.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setView((view) => zoomView(view, event.deltaY < 0 ? 1.12 : 1 / 1.12));
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  }, [setView]);
  return (
    <canvas
      ref={ref}
      className="mask-canvas"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === '+' || e.key === '=') setView((v) => zoomView(v, 1.25));
        if (e.key === '-') setView((v) => zoomView(v, 0.8));
        if (e.key === '0') setView({ zoom: 1, x: 0, y: 0 });
      }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY };
        origin.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const dx = (e.clientX - drag.current.x) / e.currentTarget.clientWidth;
        const dy = (e.clientY - drag.current.y) / e.currentTarget.clientWidth;
        drag.current = { x: e.clientX, y: e.clientY };
        setView((v) => ({
          ...v,
          x: Math.max(-v.zoom / 2, Math.min(v.zoom / 2, v.x + dx)),
          y: Math.max(-v.zoom / 2, Math.min(v.zoom / 2, v.y + dy)),
        }));
      }}
      onPointerUp={(e) => {
        if (
          onSelect &&
          origin.current &&
          Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) < 4
        ) {
          const box = e.currentTarget.getBoundingClientRect();
          const u =
            ((e.clientX - box.left) / box.width - 0.5 - options.view.x) / options.view.zoom + 0.5;
          const v =
            ((e.clientY - box.top) / box.height - 0.5 - options.view.y) / options.view.zoom + 0.5;
          if (u >= 0 && v >= 0 && u < 1 && v < 1) {
            const instance = instances.find(
              (g) =>
                g.mask.pixels[
                  Math.floor(v * g.mask.height) * g.mask.width + Math.floor(u * g.mask.width)
                ],
            );
            if (instance) onSelect(instance.id);
          }
        }
        drag.current = null;
        origin.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
        origin.current = null;
      }}
    />
  );
}
