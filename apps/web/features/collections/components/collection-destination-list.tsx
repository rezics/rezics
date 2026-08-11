"use client";

import { Button, Spinner } from "@rezics/ui";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BookmarkIcon, CheckIcon, LibraryIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import type { CollectionListItem } from "../data/collection-list";

const CollectionDestinationRowHeight = 52;

export function CollectionDestinationList({
	ariaLabel,
	changingCollectionId,
	disabled,
	emptyLabel,
	favoritesLabel,
	hasNextPage,
	isFetchingNextPage,
	items,
	loadingLabel,
	nextPageError,
	onLoadNextPage,
	onToggle,
	retryLabel,
	targetId,
	unnamedLabel,
}: {
	readonly ariaLabel: string;
	readonly changingCollectionId?: string;
	readonly disabled: boolean;
	readonly emptyLabel: string;
	readonly favoritesLabel: string;
	readonly hasNextPage: boolean;
	readonly isFetchingNextPage: boolean;
	readonly items: readonly CollectionListItem[];
	readonly loadingLabel: string;
	readonly nextPageError: unknown;
	readonly onLoadNextPage: () => void;
	readonly onToggle: (collection: CollectionListItem) => void;
	readonly retryLabel: string;
	readonly targetId: string;
	readonly unnamedLabel: string;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [activeIndex, setActiveIndex] = useState(0);
	const getItemKey = useCallback(
		(index: number) => items[index]?.id ?? `collection-destination-${index}`,
		[items],
	);
	const virtualizer = useVirtualizer({
		count: items.length,
		getItemKey,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => CollectionDestinationRowHeight,
		overscan: 8,
	});
	const virtualItems = virtualizer.getVirtualItems();
	const lastVirtualIndex = virtualItems.at(-1)?.index;
	const focusableIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

	useEffect(() => {
		if (
			lastVirtualIndex === undefined ||
			lastVirtualIndex < items.length - 4 ||
			!hasNextPage ||
			isFetchingNextPage ||
			nextPageError
		)
			return;
		onLoadNextPage();
	}, [
		hasNextPage,
		isFetchingNextPage,
		items.length,
		lastVirtualIndex,
		nextPageError,
		onLoadNextPage,
	]);

	function focusOption(index: number) {
		const boundedIndex = Math.min(Math.max(index, 0), Math.max(items.length - 1, 0));
		setActiveIndex(boundedIndex);
		virtualizer.scrollToIndex(boundedIndex, { align: "auto" });
		requestAnimationFrame(() => {
			scrollRef.current
				?.querySelector<HTMLButtonElement>(`[data-collection-option-index="${boundedIndex}"]`)
				?.focus();
		});
	}

	function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
		const destination =
			event.key === "ArrowDown"
				? index + 1
				: event.key === "ArrowUp"
					? index - 1
					: event.key === "Home"
						? 0
						: event.key === "End"
							? items.length - 1
							: undefined;
		if (destination === undefined) return;
		event.preventDefault();
		if (destination >= items.length && hasNextPage) onLoadNextPage();
		focusOption(destination);
	}

	return (
		<div
			aria-busy={isFetchingNextPage}
			className="min-h-40 flex-1 overflow-auto rounded-xl border border-border-weak"
			ref={scrollRef}
		>
			{items.length ? (
				<div
					aria-label={ariaLabel}
					aria-multiselectable="true"
					className="relative w-full"
					role="listbox"
					style={{ height: virtualizer.getTotalSize() }}
				>
					{virtualItems.map((virtualItem) => {
						const collection = items[virtualItem.index];
						if (!collection) return null;
						const isFavorite = collection.purpose === "favorites";
						const isSelfReference = collection.id === targetId;
						const isChanging = changingCollectionId === collection.id;
						const title = isFavorite ? favoritesLabel : (collection.title ?? unnamedLabel);
						return (
							<div
								className="absolute inset-x-0 p-1"
								key={virtualItem.key}
								style={{
									height: virtualItem.size,
									transform: `translateY(${virtualItem.start}px)`,
								}}
							>
								<Button
									aria-posinset={virtualItem.index + 1}
									aria-selected={collection.containsTarget}
									aria-setsize={hasNextPage ? -1 : items.length}
									className="h-11 w-full justify-between"
									data-collection-option-index={virtualItem.index}
									disabled={disabled || isChanging || isSelfReference}
									onClick={() => onToggle(collection)}
									onFocus={() => setActiveIndex(virtualItem.index)}
									onKeyDown={(event) => handleOptionKeyDown(event, virtualItem.index)}
									role="option"
									tabIndex={virtualItem.index === focusableIndex ? 0 : -1}
									variant={collection.containsTarget ? "secondary" : "outline"}
								>
									<span className="flex min-w-0 items-center gap-2">
										{isFavorite ? (
											<BookmarkIcon aria-hidden className="shrink-0" />
										) : (
											<LibraryIcon aria-hidden className="shrink-0" />
										)}
										<span className="truncate">{title}</span>
									</span>
									{collection.containsTarget ? (
										<CheckIcon aria-hidden className="shrink-0" />
									) : null}
								</Button>
							</div>
						);
					})}
				</div>
			) : (
				<p className="grid h-full min-h-40 place-items-center px-4 text-center text-muted-foreground text-sm">
					{emptyLabel}
				</p>
			)}
			{isFetchingNextPage ? (
				<p
					className="flex h-11 items-center justify-center gap-2 text-muted-foreground text-sm"
					role="status"
				>
					<Spinner />
					{loadingLabel}
				</p>
			) : nextPageError ? (
				<div className="grid h-12 place-items-center">
					<Button onClick={onLoadNextPage} size="sm" variant="quiet">
						{retryLabel}
					</Button>
				</div>
			) : null}
		</div>
	);
}
