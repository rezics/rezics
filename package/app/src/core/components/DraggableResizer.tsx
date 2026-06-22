import throttle from "lodash/throttle";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/shared/utils/use-media-query";

interface DraggableResizerProps {
  /**
   * Id of the sidebar wrapper element whose width will be controlled.
   * 将被控制宽度的 sidebar 包装元素的 id。
   */
  targetId: string;
  /**
   * Setter called with the new sidebar width while dragging.
   * 拖拽过程中以新的 sidebar 宽度调用的 setter。
   */
  setSidebarWidth: (width: number) => void;
  /**
   * Callback to notify whether the user is currently dragging.
   * 通知用户当前是否正在拖拽的回调。
   */
  onDragging: (dragging: boolean) => void;
  minWidth?: number;
  maxWidth?: number;
  throttleInterval?: number;
}

export const DraggableResizer: React.FC<DraggableResizerProps> = ({
  targetId,
  setSidebarWidth,
  onDragging,
  minWidth = 180,
  maxWidth = 480,
  throttleInterval = 10,
}) => {
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isMobile = useIsMobile();
  useEffect(() => {
    onDragging(isDragging);
  }, [isDragging, onDragging]);

  const throttledRef = useRef<any>(null);

  useEffect(() => {
    // Create a new throttled function.
    // 创建一个新的节流函数。
    throttledRef.current = throttle((newW: number) => {
      setSidebarWidth(newW);
    }, throttleInterval);
    // console.log("throttledRef.current", throttledRef.current);
    return () => {
      // Cancel any pending invocation on unmount.
      // 卸载时取消任何待执行的调用。
      throttledRef.current!.cancel();
    };
  }, [setSidebarWidth, throttleInterval]);

  useEffect(() => {
    const resizer: any = resizerRef.current;
    const target = document.getElementById(targetId);
    if (!target) {
      console.warn(`Draggable Resizer: Element with ID ${targetId} not found!`);
      return;
    }
    if (!resizer || !target) return;

    // Ensure the container is relatively positioned.
    // 保证容器相对定位。
    if (getComputedStyle(target).position === "static") {
      target.style.position = "relative";
    }

    const onPointerDown = (e: PointerEvent | any) => {
      e.preventDefault();
      // Capture all subsequent pointer events.
      // 捕获后续所有指针事件。
      (resizer as any).setPointerCapture(e.pointerId);
      setIsDragging(true);
      document.body.style.userSelect = "none";
    };

    const onPointerMove = (e: PointerEvent | any) => {
      if (!isDragging) return;
      const rect = target.getBoundingClientRect();
      let newW = e.clientX - rect.left;
      newW = Math.max(minWidth, Math.min(maxWidth, newW));
      throttledRef.current(newW);
    };

    const onPointerUp = (e: PointerEvent | any) => {
      setIsDragging(false);
      document.body.style.userSelect = "";
      try {
        (resizer as any).releasePointerCapture(e.pointerId);
      } catch (error) {
        console.error(error);
      }
    };

    resizer.addEventListener("pointerdown", onPointerDown);
    globalThis.addEventListener("pointermove", onPointerMove);
    globalThis.addEventListener("pointerup", onPointerUp);

    return () => {
      resizer.removeEventListener("pointerdown", onPointerDown);
      globalThis.removeEventListener("pointermove", onPointerMove);
      globalThis.removeEventListener("pointerup", onPointerUp);
      document.body.style.userSelect = "";
    };
  }, [targetId, minWidth, maxWidth, isDragging]);

  const [topValue, setTopValue] = useState(0);

  useEffect(() => {
    const updatePosition = () => {
      if (resizerRef.current) {
        const elementHeight = (resizerRef.current as any).offsetHeight;
        const windowHeight = globalThis.innerHeight;
        const calculatedTop = (windowHeight - elementHeight) / 2;
        setTopValue(calculatedTop);
      }
    };

    // Run on mount and window resize.
    // 在挂载时以及 window resize 时运行。
    updatePosition();
    globalThis.addEventListener("resize", updatePosition);

    // Cleanup event listener on unmount.
    // 卸载时清理事件监听器。
    return () => {
      globalThis.removeEventListener("resize", updatePosition);
    };
  }, []);

  if (isMobile) return null;

  return (
    <div
      ref={resizerRef}
      className="
            absolute right-[-10px] -translate-y-1/2
            h-12 w-1 hover:w-2 hover:h-16
            bg-border-defined hover:bg-border-strong
            rounded-l transition-all duration-200
            cursor-col-resize z-1000
          "
      style={{
        top: `${topValue}px`,
      }}
    />
  );
};
