"use client";

import {
	Alert,
	AlertAction,
	AlertDescription,
	Button,
	CardContent,
	ContentCard,
	Cover,
	Skeleton,
	useUiErrorMessage,
	useUiMessages,
} from "@rezics/ui";

import { UnitCoverFallback } from "@/features/units/components/unit-cover-fallback";
import { useTranslation } from "@/i18n/client";
import type { StudioMode } from "../model/studio-filters";
import type { StudioSectionId } from "../model/studio-section";
import {
	StudioContentCard,
	type StudioContentItem,
	studioContentShowsCover,
} from "./studio-content-card";

export type StudioContentListState =
	| { readonly status: "pending" }
	| { readonly error: unknown; readonly retry: () => void; readonly status: "error" }
	| { readonly items: readonly StudioContentItem[]; readonly status: "ready" };

export function StudioContentList({
	hasNextPage,
	isFetchingNextPage,
	loadMore,
	mode,
	onOpen,
	sectionId,
	state,
	emptyMessage,
}: {
	readonly hasNextPage: boolean;
	readonly isFetchingNextPage: boolean;
	readonly loadMore: () => void;
	readonly mode: StudioMode;
	readonly onOpen: (item: StudioContentItem) => void;
	readonly sectionId?: StudioSectionId;
	readonly state: StudioContentListState;
	readonly emptyMessage?: string;
}) {
	const { t } = useTranslation(["actions", "create"]);
	const messages = useUiMessages();
	const resolveError = useUiErrorMessage();

	if (state.status === "pending")
		return (
			<div aria-busy="true" className="grid gap-3">
				{Array.from({ length: 4 }, (_, index) => (
					<StudioContentSkeleton key={index} sectionId={sectionId} />
				))}
			</div>
		);

	if (state.status === "error")
		return (
			<Alert variant="destructive">
				<AlertDescription>{resolveError?.(state.error) ?? messages.error}</AlertDescription>
				<AlertAction>
					<Button onClick={state.retry} size="sm" variant="outline">
						{messages.retry}
					</Button>
				</AlertAction>
			</Alert>
		);

	if (state.items.length === 0)
		return (
			<div
				className="grid min-h-40 place-items-center px-6 py-8 text-center text-muted-foreground text-sm"
				role="status"
			>
				{emptyMessage ?? t.create.list.empty[mode]}
			</div>
		);

	return (
		<>
			<ul className="grid gap-3">
				{state.items.map((item) => (
					<li key={`${item.kind}:${item.resource.id}`}>
						<StudioContentCard item={item} onOpen={() => onOpen(item)} />
					</li>
				))}
			</ul>
			{hasNextPage ? (
				<Button
					className="mx-auto mt-5 flex"
					isLoading={isFetchingNextPage}
					onClick={loadMore}
					variant="outline"
				>
					{t.actions.loadMore}
				</Button>
			) : null}
		</>
	);
}

function StudioContentSkeleton({ sectionId }: { readonly sectionId?: StudioSectionId }) {
	const showCover = sectionId
		? studioContentShowsCover({
				cover: null,
				section: sectionId,
			})
		: false;
	return (
		<ContentCard appearance="outlined" aria-hidden className="overflow-hidden rounded-2xl">
			<CardContent
				className={
					showCover
						? "grid grid-cols-[5rem_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-5 sm:p-5"
						: "p-4 sm:p-5"
				}
			>
				{showCover && sectionId ? (
					<Cover
						alt=""
						className="w-full rounded-xl"
						fallback={<UnitCoverFallback kind={sectionId} />}
					/>
				) : null}
				<div className="grid content-start gap-3">
					<Skeleton className="h-3.5 w-1/3" />
					<Skeleton className="h-6 w-2/3" />
					<Skeleton className="h-5 w-1/2" />
					<Skeleton className="h-3.5 w-1/3" />
				</div>
			</CardContent>
		</ContentCard>
	);
}
