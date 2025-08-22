import throttle from "lodash/throttle";
import React, { useEffect, useRef, useState } from "react";

interface DraggableResizerProps {
	targetId: string;
	setSidebarWidth: any;
	onDragging: any;
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
	throttleInterval = 50,
}) => {
	const resizerRef = useRef<HTMLDivElement>(null);
	const [isDragging, setIsDragging] = useState(false);

	useEffect(() => {
		onDragging(isDragging);
	}, [isDragging]);

	// 用一个 ref 保持对节流函数的引用
	const throttledRef = useRef<any>(null);

	// 在 useEffect 里创建 + 清理节流函数
	useEffect(() => {
		// 创建一个新的节流函数
		throttledRef.current = throttle((newW: number) => {
			setSidebarWidth(newW);
			console.log("throttled width ➡", newW);
		}, throttleInterval);
		// console.log("throttledRef.current", throttledRef.current);
		return () => {
			// 卸载时取消任何待执行的调用
			throttledRef.current!.cancel();
		};
	}, []);

	useEffect(() => {
		const resizer: any = resizerRef.current;
		const target = document.getElementById(targetId);
		if (!target) {
			console.warn(
				`Draggable Resizer: Element with ID ${targetId} not found!`,
			);
			return;
		}
		if (!resizer || !target) return;

		// 保证容器相对定位
		// @ts-expect-error - getComputedStyle is defined by the browser
		if (getComputedStyle(target).position === "static") {
			target.style.position = "relative";
		}

		const onPointerDown = (e: PointerEvent | any) => {
			e.preventDefault();
			// 捕获后续所有指针事件
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
			} catch {}
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
	}, [targetId, minWidth, maxWidth, isDragging, setSidebarWidth]);

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

		// Run on mount and window resize
		updatePosition();
		globalThis.addEventListener("resize", updatePosition);

		// Cleanup event listener on unmount
		return () => {
			globalThis.removeEventListener("resize", updatePosition);
		};
	}, []);

	return (
		<div
			ref={resizerRef}
			className="
            absolute right-[-10px] -translate-y-1/2
            h-8 w-1 hover:w-2 hover:h-10
            bg-gray-300 hover:bg-gray-400
            rounded-l transition-all duration-200
            cursor-col-resize z-1000
          "
			style={{
				top: `${topValue}px`,
			}}
		/>
	);
};
