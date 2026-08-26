"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
	Children,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	isValidElement,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	Carousel,
	CarouselContent,
	CarouselControl,
	CarouselIndicator,
	CarouselIndicatorGroup,
	CarouselItem,
	useCarousel,
} from "../ui/carousel";
import { cn } from "../utils";
import { Button } from "./button";

export const ShelfItemSizeValues = ["sm", "md", "lg"] as const;

export type ShelfItemSize = (typeof ShelfItemSizeValues)[number];

export interface ShelfLabels {
	readonly label: string;
	readonly previous: string;
	readonly next: string;
	readonly page: (input: { readonly page: number; readonly pageCount: number }) => string;
	readonly item: (input: { readonly item: number; readonly itemCount: number }) => string;
}

export interface ShelfProps {
	readonly children: ReactNode;
	readonly className?: string;
	readonly itemClassName?: string;
	readonly itemSize?: ShelfItemSize;
	readonly labels: ShelfLabels;
}

const ShelfGapPixels = 12;
const ShelfTargetItemWidthPixels: Readonly<Record<ShelfItemSize, number>> = {
	sm: 144,
	md: 208,
	lg: 272,
};
const DragThresholdPixels = 6;
const DragClickSuppressionMilliseconds = 250;

interface ShelfLayout {
	readonly enhanced: boolean;
	readonly slidesPerPage: number;
}

interface PointerStart {
	readonly pointerId: number;
	readonly x: number;
	readonly y: number;
}

function resolveSlidesPerPage(width: number, itemSize: ShelfItemSize, itemCount: number): number {
	if (itemCount === 0) return 1;
	const targetItemWidth = ShelfTargetItemWidthPixels[itemSize];
	const availableSlots = Math.floor(
		(Math.max(0, width) + ShelfGapPixels) / (targetItemWidth + ShelfGapPixels),
	);
	return Math.min(itemCount, Math.max(1, availableSlots));
}

function prefersReducedMotion(): boolean {
	return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function Shelf({ children, className, itemClassName, itemSize = "md", labels }: ShelfProps) {
	const items = Children.toArray(children);
	const containerRef = useRef<HTMLDivElement>(null);
	const pointerStartRef = useRef<PointerStart | null>(null);
	const suppressClickUntilRef = useRef(0);
	const [layout, setLayout] = useState<ShelfLayout>({ enhanced: false, slidesPerPage: 1 });

	useEffect(() => {
		const container = containerRef.current;
		if (!container || typeof ResizeObserver === "undefined") return;

		const update = (width: number) => {
			const slidesPerPage = resolveSlidesPerPage(width, itemSize, items.length);
			setLayout((current) =>
				current.enhanced && current.slidesPerPage === slidesPerPage
					? current
					: { enhanced: true, slidesPerPage },
			);
		};
		const observer = new ResizeObserver((entries) => {
			const entry = entries.find(({ target }) => target === container);
			if (entry) update(entry.contentRect.width);
		});

		observer.observe(container);
		update(container.getBoundingClientRect().width);

		return () => observer.disconnect();
	}, [itemSize, items.length]);

	const clearPointer = () => {
		pointerStartRef.current = null;
		suppressClickUntilRef.current = 0;
	};
	const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!event.isPrimary) return;
		pointerStartRef.current = {
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
		};
		event.currentTarget.setPointerCapture?.(event.pointerId);
	};
	const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		const start = pointerStartRef.current;
		if (!start || start.pointerId !== event.pointerId) return;
		if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < DragThresholdPixels) {
			return;
		}
		suppressClickUntilRef.current = Number.POSITIVE_INFINITY;
	};
	const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
		const start = pointerStartRef.current;
		if (!start || start.pointerId !== event.pointerId) return;
		pointerStartRef.current = null;
		if (suppressClickUntilRef.current === Number.POSITIVE_INFINITY) {
			suppressClickUntilRef.current = Date.now() + DragClickSuppressionMilliseconds;
		}
	};

	return (
		<div className={cn("min-w-0", className)} data-slot="shelf" ref={containerRef}>
			<Carousel
				allowMouseDrag
				aria-label={labels.label}
				className="min-w-0"
				slideCount={items.length}
				slidesPerMove={layout.slidesPerPage}
				slidesPerPage={layout.slidesPerPage}
				spacing={`${ShelfGapPixels}px`}
			>
				<CarouselContent
					className="snap-x snap-mandatory scroll-smooth overflow-x-auto overscroll-x-contain rounded-none [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
					onClickCapture={(event) => {
						if (Date.now() >= suppressClickUntilRef.current) return;
						event.preventDefault();
						event.stopPropagation();
						suppressClickUntilRef.current = 0;
					}}
					onPointerCancelCapture={clearPointer}
					onPointerDownCapture={handlePointerDown}
					onPointerMoveCapture={handlePointerMove}
					onPointerUpCapture={handlePointerUp}
				>
					{items.map((item, index) => (
						<CarouselItem
							aria-label={labels.item({ item: index + 1, itemCount: items.length })}
							className={cn("snap-start", itemClassName)}
							index={index}
							key={isValidElement(item) && item.key !== null ? item.key : index}
						>
							{item}
						</CarouselItem>
					))}
				</CarouselContent>
				{layout.enhanced ? <ShelfControls labels={labels} /> : null}
			</Carousel>
		</div>
	);
}

function ShelfControls({ labels }: { readonly labels: ShelfLabels }) {
	const carousel = useCarousel();
	const pageCount = carousel.pageSnapPoints.length;

	if (pageCount <= 1) return null;

	return (
		<>
			<CarouselControl className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2">
				<Button
					aria-label={labels.previous}
					className="pointer-events-auto"
					clickEffect={false}
					disabled={!carousel.canScrollPrev}
					onClick={() => carousel.scrollPrev(prefersReducedMotion())}
					pill
					size="icon-md"
					type="button"
					variant="secondary"
				>
					<ChevronLeftIcon aria-hidden />
				</Button>
				<Button
					aria-label={labels.next}
					className="pointer-events-auto"
					clickEffect={false}
					disabled={!carousel.canScrollNext}
					onClick={() => carousel.scrollNext(prefersReducedMotion())}
					pill
					size="icon-md"
					type="button"
					variant="secondary"
				>
					<ChevronRightIcon aria-hidden />
				</Button>
			</CarouselControl>
			<CarouselIndicatorGroup aria-label={labels.label} className="mt-3">
				{carousel.pageSnapPoints.map((_, index) => (
					<CarouselIndicator
						aria-label={labels.page({ page: index + 1, pageCount })}
						index={index}
						key={index}
					/>
				))}
			</CarouselIndicatorGroup>
		</>
	);
}
