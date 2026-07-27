"use client";

import { Badge, Button, Spinner } from "@rezics/ui";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRightIcon, LockIcon, LockOpenIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import type { RealmModerationUnit } from "../data/realm-moderation-query";
import type { RealmModerationStatus } from "../model/moderation-contract";

const StatusBadgeVariants = {
	pending: "warning",
	visible: "success",
	hidden: "info",
	removed: "destructive",
} as const satisfies Record<RealmModerationStatus, "warning" | "success" | "info" | "destructive">;

export function RealmModerationQueue({
	units,
	selectedUnitId,
	hasNextPage,
	isFetchingNextPage,
	nextPageError,
	onSelect,
	onLoadNextPage,
}: {
	readonly units: readonly RealmModerationUnit[];
	readonly selectedUnitId?: string;
	readonly hasNextPage: boolean;
	readonly isFetchingNextPage: boolean;
	readonly nextPageError: unknown;
	readonly onSelect: (unit: RealmModerationUnit) => void;
	readonly onLoadNextPage: () => void;
}) {
	const { t, locale } = useTranslation(["posts", "realms"]);
	const scrollRef = useRef<HTMLDivElement>(null);
	const count = units.length + (hasNextPage ? 1 : 0);
	const virtualizer = useVirtualizer({
		count,
		getScrollElement: () => scrollRef.current,
		getItemKey: (index) => units[index]?.unitId ?? "moderation-queue-loader",
		estimateSize: () => 78,
		overscan: 8,
	});
	const virtualRows = virtualizer.getVirtualItems();
	const lastVirtualIndex = virtualRows.at(-1)?.index;

	useEffect(() => {
		if (
			lastVirtualIndex === undefined ||
			lastVirtualIndex < units.length ||
			!hasNextPage ||
			isFetchingNextPage ||
			nextPageError
		)
			return;
		onLoadNextPage();
	}, [
		hasNextPage,
		isFetchingNextPage,
		lastVirtualIndex,
		nextPageError,
		onLoadNextPage,
		units.length,
	]);

	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			<div
				aria-label={t.realms.moderationQueueLabel}
				className="max-h-[36rem] min-h-64 overflow-auto"
				ref={scrollRef}
				role="list"
			>
				<div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
					{virtualRows.map((virtualRow) => {
						const unit = units[virtualRow.index];
						if (!unit)
							return (
								<div
									className="absolute inset-x-0 grid place-items-center p-4"
									data-index={virtualRow.index}
									key={virtualRow.key}
									ref={virtualizer.measureElement}
									role="status"
									style={{ transform: `translateY(${virtualRow.start}px)` }}
								>
									{nextPageError ? (
										<div className="grid justify-items-center gap-2">
											<RequestFailure error={nextPageError} />
											<Button
												onClick={onLoadNextPage}
												size="sm"
												type="button"
												variant="outline"
											>
												{t.realms.retryModerationQueue}
											</Button>
										</div>
									) : (
										<span className="flex items-center gap-2 text-muted-foreground text-sm">
											<Spinner />
											{t.realms.loadingModerationQueue}
										</span>
									)}
								</div>
							);
						const title = unit.title ?? t.posts.untitled;
						const selected = selectedUnitId === unit.unitId;
						return (
							<div
								aria-posinset={virtualRow.index + 1}
								aria-setsize={hasNextPage ? -1 : units.length}
								className="absolute inset-x-0 border-b last:border-b-0"
								data-index={virtualRow.index}
								key={virtualRow.key}
								ref={virtualizer.measureElement}
								role="listitem"
								style={{ transform: `translateY(${virtualRow.start}px)` }}
							>
								<button
									aria-current={selected ? "true" : undefined}
									aria-label={t.realms.reviewModerationItem({ title })}
									className="grid min-h-[4.875rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-start transition-colors hover:bg-muted/48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-current:bg-brand/8"
									onClick={() => onSelect(unit)}
									type="button"
								>
									<span className="min-w-0">
										<span className="flex min-w-0 items-center gap-2">
											<Badge variant={StatusBadgeVariants[unit.status]}>
												{t.realms.moderationStates[unit.status]}
											</Badge>
											<span className="truncate font-medium">{title}</span>
										</span>
										<span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
											<span className="inline-flex items-center gap-1">
												{unit.postTargetingLocked ? (
													<LockIcon
														aria-hidden="true"
														className="size-3"
													/>
												) : (
													<LockOpenIcon
														aria-hidden="true"
														className="size-3"
													/>
												)}
												{unit.postTargetingLocked
													? t.realms.postTargetingLocked
													: t.realms.postTargetingUnlocked}
											</span>
											<time dateTime={unit.updatedAt}>
												{t.realms.moderationUpdatedAt({
													date: formatDateTime(
														unit.updatedAt,
														locale.current,
													),
												})}
											</time>
										</span>
									</span>
									<ChevronRightIcon
										aria-hidden="true"
										className="size-4 text-muted-foreground"
									/>
								</button>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function formatDateTime(value: string, language: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat(language, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}
