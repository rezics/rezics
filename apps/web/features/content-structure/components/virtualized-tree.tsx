"use client";

import { defaultRangeExtractor, type Range, useWindowVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@rezics/ui";
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

import type { EditableTreeNode, VisibleEditableTreeEntry } from "../model/editable-tree";

const MinimumListHeight = 36 * 16;
const EstimatedRowHeight = 6 * 16;

type VisibleTreeEntry<Node extends EditableTreeNode> = VisibleEditableTreeEntry<Node>;

export function VirtualizedTreeRows<Node extends EditableTreeNode>({
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
	readonly entries: readonly VisibleTreeEntry<Node>[];
	readonly label: string;
	readonly onDragOverCapture?: ComponentPropsWithRef<"div">["onDragOverCapture"];
	readonly onScrollToNode?: () => void;
	readonly pinnedNodeIds?: ReadonlySet<string>;
	readonly renderRow: (entry: (typeof entries)[number], index: number) => ReactNode;
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
			scrollToNodeId ? entries.findIndex(({ entry }) => entry.node.id === scrollToNodeId) : -1,
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

export function TreeEditorRowFrame({
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
				activePlacement === "inside" && "bg-primary/8 outline-2 outline-primary -outline-offset-2",
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
