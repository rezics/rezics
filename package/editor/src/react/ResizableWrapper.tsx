import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ResizeConfig } from "../editor/types";
import "./ResizableWrapper.css";

interface ResizableWrapperProps {
  config: ResizeConfig;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}

function clampHeight(h: number, min: number, max: number) {
  return Math.min(max, Math.max(min, h));
}

export function ResizableWrapper({
  config,
  disabled,
  className,
  style,
  children,
}: ResizableWrapperProps) {
  const minH = config.minHeight ?? 100;
  const maxH = config.maxHeight ?? Infinity;

  const [currentHeight, setCurrentHeight] = useState(() =>
    clampHeight(config.height, minH, maxH),
  );

  const dragStartRef = useRef<{ y: number; height: number } | null>(null);

  // Sync when config.height changes externally
  useEffect(() => {
    setCurrentHeight(clampHeight(config.height, minH, maxH));
  }, [config.height, minH, maxH]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStartRef.current = { y: e.clientY, height: currentHeight };

      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragStartRef.current) return;
        const delta = ev.clientY - dragStartRef.current.y;
        const newH = clampHeight(
          dragStartRef.current.height + delta,
          minH,
          maxH,
        );
        setCurrentHeight(newH);
      };

      const onMouseUp = (ev: MouseEvent) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        if (dragStartRef.current && config.onHeightChange) {
          const delta = ev.clientY - dragStartRef.current.y;
          const finalH = clampHeight(
            dragStartRef.current.height + delta,
            minH,
            maxH,
          );
          config.onHeightChange(finalH);
        }
        dragStartRef.current = null;
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [currentHeight, minH, maxH, config.onHeightChange],
  );

  if (disabled) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={`rezics-resize-container${className ? ` ${className}` : ""}`}
      style={{ ...style, height: currentHeight }}
    >
      {children}
      <div
        className="rezics-resize-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize editor height"
        aria-valuenow={currentHeight}
        aria-valuemin={minH}
        aria-valuemax={maxH === Infinity ? undefined : maxH}
        onMouseDown={onMouseDown}
      />
    </div>
  );
}
