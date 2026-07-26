"use client";

import { defaultRangeExtractor, type Range, useWindowVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, Eye, ListTree, Text } from "lucide-react";
import {
	type ComponentPropsWithRef,
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { cn } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import {
	EmptyBookStructureContentMetrics,
	type BookStructureContentMetrics,
	type BookStructureViewNode,
	type VisibleBookStructureTreeNode,
} from "../model/book-content-structure-view";

const MinimumListHeight = 36 * 16;
const EstimatedRowHeight = 6 * 16;

export function BookContentStructureSection({
	actions,
	chapterCount,
	children,
	labelCount,
}: {
	readonly actions?: ReactNode;
	readonly chapterCount: number;
	readonly children: ReactNode;
	readonly labelCount: number;
}) {
	const { t } = useTranslation(["units"]);

	return (
		<section>
			<header className="flex flex-wrap items-end justify-between gap-4 border-b border-border-weak pb-4">
				<div className="min-w-0">
					<h2 className="font-heading font-semibold text-lg">{t.units.content.title}</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						{t.units.content.structureSummary({
							chapters: chapterCount,
							labels: labelCount,
						})}
					</p>
				</div>
				{actions ? (
					<div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
				) : null}
			</header>
			{children}
		</section>
	);
}

export function EmptyBookContentStructureList() {
	const { t } = useTranslation(["units"]);

	return (
		<div className="grid min-h-[36rem] place-items-center px-6 text-center">
			<div>
				<ListTree aria-hidden className="mx-auto size-8 text-muted-foreground" />
				<p className="mt-3 text-muted-foreground text-sm">{t.units.content.noContent}</p>
			</div>
		</div>
	);
}

export function VirtualizedBookContentStructureRows<Node extends BookStructureViewNode>({
	ariaMultiselectable,
	entries,
	label,
	onDragOverCapture,
	onScrollToNode,
	pinnedNodeIds,
	renderRow,
	scrollToNodeId,
}: {
	readonly ariaMultiselectable?: boolean;
	readonly entries: readonly VisibleBookStructureTreeNode<Node>[];
	readonly label: string;
	readonly onDragOverCapture?: ComponentPropsWithRef<"div">["onDragOverCapture"];
	readonly onScrollToNode?: () => void;
	readonly pinnedNodeIds?: ReadonlySet<string>;
	readonly renderRow: (entry: VisibleBookStructureTreeNode<Node>, index: number) => ReactNode;
	readonly scrollToNodeId?: string;
}) {
	const listRef = useRef<HTMLDivElement>(null);
	const [scrollMargin, setScrollMargin] = useState(0);
	const pinnedIndexes = useMemo(() => {
		if (!pinnedNodeIds?.size) return [];
		const indexes: number[] = [];
		for (let index = 0; index < entries.length; index += 1) {
			const entry = entries[index];
			if (entry && pinnedNodeIds.has(entry.entry.node.id)) indexes.push(index);
		}
		return indexes;
	}, [entries, pinnedNodeIds]);
	const getItemKey = useCallback(
		(index: number) => entries[index]?.entry.node.id ?? index,
		[entries],
	);
	const rangeExtractor = useCallback(
		(range: Range) => {
			if (!pinnedIndexes.length) return defaultRangeExtractor(range);
			return [...new Set([...defaultRangeExtractor(range), ...pinnedIndexes])].toSorted(
				(left, right) => left - right,
			);
		},
		[pinnedIndexes],
	);
	const virtualizer = useWindowVirtualizer<HTMLDivElement>({
		count: entries.length,
		estimateSize: () => EstimatedRowHeight,
		getItemKey,
		overscan: 8,
		rangeExtractor,
		scrollMargin,
	});
	const scrollTargetIndex = useMemo(
		() =>
			scrollToNodeId
				? entries.findIndex(({ entry }) => entry.node.id === scrollToNodeId)
				: -1,
		[entries, scrollToNodeId],
	);

	useEffect(() => {
		if (scrollTargetIndex < 0) return;
		const frame = requestAnimationFrame(() => {
			virtualizer.scrollToIndex(scrollTargetIndex, { align: "center" });
			onScrollToNode?.();
		});
		return () => cancelAnimationFrame(frame);
	}, [onScrollToNode, scrollTargetIndex, virtualizer]);

	useLayoutEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const nextScrollMargin = list.getBoundingClientRect().top + window.scrollY;
		setScrollMargin((current) =>
			Math.abs(current - nextScrollMargin) < 0.5 ? current : nextScrollMargin,
		);
	});

	useLayoutEffect(() => {
		const update = () => {
			const list = listRef.current;
			if (!list) return;
			const nextScrollMargin = list.getBoundingClientRect().top + window.scrollY;
			setScrollMargin((current) =>
				Math.abs(current - nextScrollMargin) < 0.5 ? current : nextScrollMargin,
			);
		};
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);

	return (
		<div
			aria-label={label}
			aria-multiselectable={ariaMultiselectable}
			className="relative w-full"
			onDragOverCapture={onDragOverCapture}
			ref={listRef}
			role="tree"
			style={{ height: Math.max(virtualizer.getTotalSize(), MinimumListHeight) }}
		>
			{virtualizer.getVirtualItems().map((virtualRow) => {
				const entry = entries[virtualRow.index];
				if (!entry) return null;
				return (
					<div
						className="absolute start-0 top-0 w-full"
						data-index={virtualRow.index}
						key={virtualRow.key}
						ref={virtualizer.measureElement}
						role="none"
						style={{
							transform: `translateY(${virtualRow.start - scrollMargin}px)`,
						}}
					>
						{renderRow(entry, virtualRow.index)}
					</div>
				);
			})}
		</div>
	);
}

export function BookContentStructureRowFrame({
	activePlacement,
	className,
	children,
	depth,
	dragging,
	selected,
	style,
	...props
}: Omit<ComponentPropsWithRef<"div">, "children"> & {
	readonly activePlacement?: "before" | "inside" | "after";
	readonly children: ReactNode;
	readonly depth: number;
	readonly dragging?: boolean;
	readonly selected?: boolean;
}) {
	return (
		<div
			className={cn(
				"group/structure-row relative flex min-h-24 items-center gap-3 pe-3 transition-colors",
				dragging && "opacity-45",
				activePlacement === "before" && "border-t-2 border-t-primary",
				activePlacement === "inside" &&
					"bg-primary/8 outline-2 outline-primary -outline-offset-2",
				activePlacement === "after" && "border-b-2 border-b-primary",
				!activePlacement && !selected && "hover:bg-muted/40",
				selected && "bg-accent/70",
				className,
			)}
			style={{
				...style,
				paddingInlineStart: `${1 + depth * 2}rem`,
			}}
			{...props}
		>
			{depth > 0 ? (
				<span
					aria-hidden
					className="absolute inset-y-0 w-px bg-border-weak"
					style={{ insetInlineStart: `${depth * 2}rem` }}
				/>
			) : null}
			<span
				aria-hidden
				className="pointer-events-none absolute bottom-0 h-px bg-border-weak"
				style={{
					insetInlineEnd: 0,
					insetInlineStart: depth > 0 ? `${depth * 2}rem` : 0,
				}}
			/>
			{children}
		</div>
	);
}

export function BookContentStructureRowText({
	contentMetrics = EmptyBookStructureContentMetrics,
	directChildCount,
	expanded,
	label,
	language,
	metadataAfter,
	title,
}: {
	readonly contentMetrics?: BookStructureContentMetrics;
	readonly directChildCount: number;
	readonly expanded: boolean;
	readonly label: boolean;
	readonly language: BookStructureViewNode["language"];
	readonly metadataAfter?: ReactNode;
	readonly title: string;
}) {
	const { t } = useTranslation(["units"]);

	return (
		<span className="min-w-0 flex-1">
			<span className="flex min-w-0 items-center gap-2">
				{label ? (
					<ChevronRight
						aria-hidden
						className={cn(
							"size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
							expanded && "rotate-90",
						)}
					/>
				) : null}
				<span className="truncate font-heading font-semibold text-base text-foreground">
					{title}
				</span>
			</span>
			<span className="mt-2 flex items-center gap-4 text-muted-foreground text-sm">
				{label ? (
					<span>{t.units.content.childCount({ count: directChildCount })}</span>
				) : null}
				<span className="inline-flex items-center gap-1.5">
					<Text aria-hidden className="size-4" />
					{language === "zh"
						? label
							? t.units.content.totalCharacterCount({
									count: contentMetrics.characterCount,
								})
							: t.units.chapter.characterCount({
									count: contentMetrics.characterCount,
								})
						: label
							? t.units.content.totalWordCount({
									count: contentMetrics.wordCount,
								})
							: t.units.chapter.wordCount({
									count: contentMetrics.wordCount,
								})}
				</span>
				{metadataAfter}
			</span>
		</span>
	);
}

/**
 * @todo Render the persisted chapter view count beside this affordance after
 * durable per-chapter readership records are available from the structure API.
 */
export function BookContentStructureChapterViewMetric({ label }: { readonly label: string }) {
	return (
		<span aria-label={label} className="inline-flex items-center" role="img" title={label}>
			<Eye aria-hidden className="size-4" />
		</span>
	);
}
