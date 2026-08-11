"use client";

import {
	type PostApiProgressSearchStatus200,
	useGetApiSearchFeaturesByTemplate,
	usePostApiProgressSearch,
} from "@rezics/openapi-tanstack-query";
import {
	parseSearchFeatureDefinition,
	unitFilterSearchQuery,
	type SearchFeatureDefinition,
} from "@rezics/filter";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import {
	Badge,
	Button,
	ContentCard,
	Cover,
	PageHeading,
	Progress,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { formatRelativeTime } from "@/features/content-feed/model/format-relative-time";
import { SearchFeature, type SearchFeatureRequest } from "@/features/search/search-feature";
import { UnitCoverFallback } from "@/features/units/components/unit-cover-fallback";
import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { ProgressImportDialog } from "../components/progress-import-dialog";
import { UnitProgressDialog } from "../components/unit-progress-dialog";
import { UnitProgressProvider } from "../components/unit-progress-provider";
import { clampProgress, type UnitProgressDomain } from "../model/progress-record";
import { unitProgressHref } from "../routing/progress-routes";

type ProgressSearchResult = PostApiProgressSearchStatus200;
type ProgressSearchItem = ProgressSearchResult["items"][number];

export function ProgressPage() {
	return (
		<RequireSession>
			<ProgressList />
		</RequireSession>
	);
}

function ProgressList() {
	const localizationLanguages = useLocalizationLanguages();
	const definitionQuery = useGetApiSearchFeaturesByTemplate({
		path: { template: "progress" },
	});
	const searchMutation = usePostApiProgressSearch();
	const searchProgress = searchMutation.mutateAsync;
	const { t } = useTranslation(["engagement", "search", "ui"]);
	const [lastRequest, setLastRequest] = useState<SearchFeatureRequest>();
	const [result, setResult] = useState<ProgressSearchResult>();
	const [selectedDomain, setSelectedDomain] = useState<UnitProgressDomain>();
	const requestSequence = useRef(0);
	const initialExecuted = useRef(false);

	const fetchProgress = useCallback(
		async (
			request: SearchFeatureRequest,
			options: {
				readonly append?: boolean;
				readonly cursor?: string;
				readonly preserveResult?: boolean;
			} = {},
		) => {
			const sequence = ++requestSequence.current;
			if (!options.append && !options.preserveResult) setResult(undefined);
			try {
				const response = await searchProgress({
					body: {
						injections: request.injections,
						state: {
							...request.state,
							...(options.cursor ? { cursor: options.cursor } : {}),
						},
						localizationLanguages,
					},
				});
				if (sequence !== requestSequence.current) return;
				setResult((current) =>
					options.append && current
						? {
								...response,
								items: [...current.items, ...response.items],
							}
						: response,
				);
			} catch {
				// The typed mutation state supplies the visible API error.
			}
		},
		[localizationLanguages, searchProgress],
	);

	const execute = useCallback(
		(request: SearchFeatureRequest) => {
			setLastRequest(request);
			void fetchProgress(request);
		},
		[fetchProgress],
	);

	useEffect(() => {
		if (!definitionQuery.data || initialExecuted.current) return;
		initialExecuted.current = true;
		execute({ injections: [], state: {} });
	}, [definitionQuery.data, execute]);

	if (definitionQuery.isPending) return <QueryPending />;
	if (definitionQuery.isError)
		return (
			<QueryFailure error={definitionQuery.error} retry={() => void definitionQuery.refetch()} />
		);

	const definition: SearchFeatureDefinition = parseSearchFeatureDefinition(definitionQuery.data);
	const activeQuery = unitFilterSearchQuery(lastRequest?.state.filter);
	const total = result?.total;
	const totalValue = toNonNegativeApiInteger(total?.value ?? 0);

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				action={<ProgressImportDialog variant="outline" />}
				title={t.engagement.progress}
			/>
			<SearchFeature
				definition={definition}
				error={searchMutation.isError}
				id="progress-search"
				onExecute={execute}
				pending={searchMutation.isPending}
				queryLabel={t.engagement.searchProgress}
				queryPlaceholder={t.engagement.searchProgressPlaceholder}
				surface="search"
			>
				{result ? (
					<section aria-live="polite" className="grid gap-4">
						<p className="text-muted-foreground text-sm">
							{total?.kind === "lower-bound"
								? t.search.resultCountLowerBound({ count: totalValue })
								: t.search.resultCount({ count: totalValue })}
						</p>
						{result.items.length > 0 ? (
							<div className="grid gap-3">
								{result.items.map((item) => (
									<ProgressListItem item={item} key={item.unitId} onEdit={setSelectedDomain} />
								))}
							</div>
						) : (
							<div className="rounded-2xl border border-border-weak px-5 py-10 text-center">
								<p className="font-medium">{activeQuery ? t.search.empty : t.ui.emptyProgress}</p>
								{activeQuery ? (
									<p className="mt-1 text-muted-foreground text-sm">{t.search.emptyBody}</p>
								) : null}
							</div>
						)}
						{result.nextCursor && lastRequest ? (
							<div className="flex justify-center pt-2">
								<Button
									disabled={searchMutation.isPending}
									isLoading={searchMutation.isPending}
									onClick={() =>
										void fetchProgress(lastRequest, {
											append: true,
											cursor: result.nextCursor,
											preserveResult: true,
										})
									}
									variant="outline"
								>
									{t.engagement.progressJournal.loadMore}
								</Button>
							</div>
						) : null}
					</section>
				) : searchMutation.isPending ? (
					<QueryPending />
				) : null}
				<RequestFailure error={searchMutation.error} fallback={t.ui.retryLater} />
			</SearchFeature>

			{selectedDomain ? (
				<ProgressEditorHost
					domain={selectedDomain}
					key={selectedDomain.unitId}
					onClosed={() => {
						setSelectedDomain(undefined);
						if (lastRequest) void fetchProgress(lastRequest, { preserveResult: true });
					}}
				/>
			) : null}
		</main>
	);
}

function ProgressListItem({
	item,
	onEdit,
}: {
	readonly item: ProgressSearchItem;
	readonly onEdit: (domain: UnitProgressDomain) => void;
}) {
	const { t, locale } = useTranslation(["engagement", "ui"]);
	const title = useChineseContentText(
		item.title ?? t.ui.unnamed,
		item.title ? item.language : null,
	);
	const summary = useChineseContentText(item.summary ?? "", item.summary ? item.language : null);
	const percent = Math.round(clampProgress(item.progress) * 100);
	const copy = t.engagement.progressByType[item.type];
	const href = publicUnitHref(item.type, { id: item.unitId });
	const listSummary =
		item.type === "software"
			? t.engagement.progressByType.software.listSummary({
					count: toNonNegativeApiInteger(item.completedCount),
					minutes: Math.round((toFiniteApiNumber(item.totalTimeMs) ?? 0) / 60_000),
				})
			: item.type === "media"
				? t.engagement.progressByType.media.listSummary({
						count: toNonNegativeApiInteger(item.completedCount),
						percent,
					})
				: t.engagement.progressByType.book.listSummary({
						count: toNonNegativeApiInteger(item.completedCount),
						percent,
					});

	return (
		<ContentCard aria-labelledby={`progress-item-${item.unitId}`}>
			<div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 px-4 py-4 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:px-5">
				{href ? (
					<Link className="self-start" href={href}>
						<Cover
							alt={title}
							className="w-full rounded-xl border border-border-weak shadow-sm/5"
							fallback={<UnitCoverFallback kind={item.type} />}
							sizes="(min-width: 640px) 120px, 80px"
							src={item.cover?.url}
						/>
					</Link>
				) : (
					<Cover
						alt={title}
						className="w-full rounded-xl border border-border-weak shadow-sm/5"
						fallback={<UnitCoverFallback kind={item.type} />}
						sizes="(min-width: 640px) 120px, 80px"
						src={item.cover?.url}
					/>
				)}
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<Badge variant="secondary">{copy.statuses[item.status]}</Badge>
						<time className="text-muted-foreground text-xs" dateTime={item.lastSeenAt}>
							{t.engagement.progressUpdatedAt({
								time: formatRelativeTime(item.lastSeenAt, locale.target),
							})}
						</time>
					</div>
					{href ? (
						<Link className="block" href={href}>
							<h2
								className="mt-2 font-heading font-black text-[1.05rem] leading-snug"
								id={`progress-item-${item.unitId}`}
							>
								{title}
							</h2>
						</Link>
					) : (
						<h2
							className="mt-2 font-heading font-black text-[1.05rem] leading-snug"
							id={`progress-item-${item.unitId}`}
						>
							{title}
						</h2>
					)}
					{summary ? (
						<p className="mt-1 line-clamp-2 text-muted-foreground text-sm leading-6">{summary}</p>
					) : null}
					<div className="mt-4">
						<div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
							<span className="font-medium text-muted-foreground">{copy.progressLabel}</span>
							<span className="font-semibold tabular-nums">
								{t.engagement.progressPercent({ percent })}
							</span>
						</div>
						<Progress
							aria-label={copy.progressLabel}
							className="gap-0 [&_[data-slot=progress-track]]:h-1"
							max={100}
							value={percent}
						/>
						<p className="mt-2 text-muted-foreground text-xs">{listSummary}</p>
					</div>
					<div className="mt-4 flex flex-wrap gap-2">
						<Button
							onClick={() => onEdit({ type: item.type, unitId: item.unitId })}
							size="sm"
							variant="solid"
						>
							{t.engagement.updateProgress}
						</Button>
						<Button asChild size="sm" variant="outline">
							<Link href={unitProgressHref(item.type, item.unitId)}>
								{t.engagement.viewProgressHistory}
							</Link>
						</Button>
					</div>
				</div>
			</div>
		</ContentCard>
	);
}

function ProgressEditorHost({
	domain,
	onClosed,
}: {
	readonly domain: UnitProgressDomain;
	readonly onClosed: () => void;
}) {
	return (
		<UnitProgressProvider domain={domain} initialEditorOpen onEditorClosed={onClosed}>
			<UnitProgressDialog />
		</UnitProgressProvider>
	);
}
