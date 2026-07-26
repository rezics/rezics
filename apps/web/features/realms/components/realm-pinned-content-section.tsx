"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, PinIcon } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import {
	Button,
	Card,
	CardContent,
	CardMedia,
	Carousel,
	CarouselControl,
	CarouselContent,
	CarouselItem,
	cn,
	PortableTextContent,
	Skeleton,
	useCarousel,
	useIsMobile,
} from "@rezics/ui";
import { readPortableText } from "@/lib/block";

export interface RealmPinnedContentItem {
	readonly id: string;
	readonly body?: Parameters<typeof readPortableText>[0];
	readonly href?: string;
	readonly imageUrl?: string | null;
	readonly summary?: string | null;
	readonly title?: string | null;
}

export type RealmPinnedContentState =
	| { readonly status: "loading" }
	| { readonly status: "error"; readonly feedback: ReactNode }
	| { readonly status: "ready"; readonly items: readonly RealmPinnedContentItem[] };

export interface RealmPinnedContentSectionProps {
	readonly emptyLabel: string;
	readonly nextLabel: string;
	readonly previousLabel: string;
	readonly state: RealmPinnedContentState;
	readonly title: string;
	readonly untitledLabel: string;
}

export function RealmPinnedContentSection({
	emptyLabel,
	nextLabel,
	previousLabel,
	state,
	title,
	untitledLabel,
}: RealmPinnedContentSectionProps) {
	const [open, setOpen] = useState(true);
	const contentId = useId();

	return (
		<section aria-label={title} className="min-w-0">
			<Button
				aria-controls={contentId}
				aria-expanded={open}
				className="h-auto w-full justify-between px-3 py-2 text-left font-semibold"
				onClick={() => setOpen((current) => !current)}
				type="button"
				variant="quiet"
			>
				<span className="flex min-w-0 items-center gap-2">
					<PinIcon aria-hidden data-icon="inline-start" />
					<span>{title}</span>
				</span>
				<ChevronDownIcon
					aria-hidden
					className={cn(
						"text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
						open && "rotate-180",
					)}
					data-icon="inline-end"
				/>
			</Button>
			{open ? (
				<div className="min-w-0 pt-3" id={contentId}>
					{state.status === "loading" ? (
						<div className="grid auto-cols-[minmax(13rem,72%)] grid-flow-col gap-3 overflow-x-auto pb-1 sm:auto-cols-[minmax(13rem,42%)] xl:auto-cols-[minmax(13rem,32%)]">
							{Array.from({ length: 3 }, (_, index) => (
								<Skeleton className="h-44 rounded-xl" key={index} />
							))}
						</div>
					) : state.status === "error" ? (
						state.feedback
					) : state.items.length === 0 ? (
						<p className="px-3 text-muted-foreground text-sm">{emptyLabel}</p>
					) : (
						<RealmPinnedCarousel
							items={state.items}
							nextLabel={nextLabel}
							previousLabel={previousLabel}
							title={title}
							untitledLabel={untitledLabel}
						/>
					)}
				</div>
			) : null}
		</section>
	);
}

function RealmPinnedCarousel({
	items,
	nextLabel,
	previousLabel,
	title,
	untitledLabel,
}: {
	readonly items: readonly RealmPinnedContentItem[];
	readonly nextLabel: string;
	readonly previousLabel: string;
	readonly title: string;
	readonly untitledLabel: string;
}) {
	const isMobile = useIsMobile();
	const pointerStartRef = useRef<{
		readonly pointerId: number;
		readonly x: number;
		readonly y: number;
	} | null>(null);
	const suppressClickUntilRef = useRef(0);
	const slidesPerPage = Math.min(items.length, isMobile ? 1.15 : 3);

	return (
		<Carousel
			allowMouseDrag
			aria-label={title}
			className="min-w-0"
			slideCount={items.length}
			slidesPerMove={1}
			slidesPerPage={slidesPerPage}
			spacing="12px"
		>
			<CarouselContent
				onClickCapture={(event) => {
					if (Date.now() >= suppressClickUntilRef.current) return;
					event.preventDefault();
					event.stopPropagation();
					suppressClickUntilRef.current = 0;
				}}
				onPointerCancelCapture={() => {
					pointerStartRef.current = null;
					suppressClickUntilRef.current = 0;
				}}
				onPointerDownCapture={(event) => {
					if (!event.isPrimary) return;
					pointerStartRef.current = {
						pointerId: event.pointerId,
						x: event.clientX,
						y: event.clientY,
					};
					event.currentTarget.setPointerCapture?.(event.pointerId);
				}}
				onPointerMoveCapture={(event) => {
					const start = pointerStartRef.current;
					if (!start || start.pointerId !== event.pointerId) return;
					if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6) return;
					suppressClickUntilRef.current = Number.POSITIVE_INFINITY;
				}}
				onPointerUpCapture={(event) => {
					const start = pointerStartRef.current;
					if (!start || start.pointerId !== event.pointerId) return;
					pointerStartRef.current = null;
					if (suppressClickUntilRef.current === Number.POSITIVE_INFINITY) {
						suppressClickUntilRef.current = Date.now() + 250;
					}
				}}
			>
				{items.map((item, index) => (
					<CarouselItem className="[&_img]:rounded-none" index={index} key={item.id}>
						<RealmPinnedItemCard item={item} untitledLabel={untitledLabel} />
					</CarouselItem>
				))}
			</CarouselContent>
			{items.length > slidesPerPage ? (
				<RealmPinnedCarouselControls nextLabel={nextLabel} previousLabel={previousLabel} />
			) : null}
		</Carousel>
	);
}

function RealmPinnedCarouselControls({
	nextLabel,
	previousLabel,
}: {
	readonly nextLabel: string;
	readonly previousLabel: string;
}) {
	const carousel = useCarousel();

	return (
		<CarouselControl className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2">
			<Button
				aria-label={previousLabel}
				className="pointer-events-auto"
				clickEffect={false}
				disabled={!carousel.canScrollPrev}
				onClick={() => carousel.scrollPrev()}
				pill
				size="icon-md"
				variant="secondary"
			>
				<ChevronLeftIcon aria-hidden />
			</Button>
			<Button
				aria-label={nextLabel}
				className="pointer-events-auto"
				clickEffect={false}
				disabled={!carousel.canScrollNext}
				onClick={() => carousel.scrollNext()}
				pill
				size="icon-md"
				variant="secondary"
			>
				<ChevronRightIcon aria-hidden />
			</Button>
		</CarouselControl>
	);
}

function RealmPinnedItemCard({
	item,
	untitledLabel,
}: {
	readonly item: RealmPinnedContentItem;
	readonly untitledLabel: string;
}) {
	const title = item.title?.trim() || untitledLabel;
	const content = (
		<Card appearance="outlined" className="h-44 min-w-0 gap-0 overflow-hidden py-0 shadow-none">
			{item.imageUrl ? (
				<>
					<CardMedia className="h-28 px-0" variant="image">
						<img alt="" loading="lazy" src={item.imageUrl} />
					</CardMedia>
					<CardContent className="min-h-0 px-4 py-3">
						<h3 className="line-clamp-2 font-semibold text-sm leading-5">{title}</h3>
					</CardContent>
				</>
			) : (
				<CardContent className="min-h-0 p-4">
					<h3 className="line-clamp-2 font-semibold leading-5">{title}</h3>
					{item.summary ? (
						<p className="mt-2 line-clamp-4 text-muted-foreground text-sm leading-5">
							{item.summary}
						</p>
					) : item.body ? (
						<PortableTextContent
							className="mt-2 line-clamp-4 text-muted-foreground leading-5"
							value={readPortableText(item.body)}
							variant="preview"
						/>
					) : null}
				</CardContent>
			)}
		</Card>
	);

	return item.href ? (
		<Link className="block min-w-0 text-inherit no-underline" href={item.href}>
			{content}
		</Link>
	) : (
		content
	);
}
