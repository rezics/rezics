"use client";

import {
	getApiReportsMe,
	getApiReportsMeQueryKey,
	type GetApiReportsMeQuery,
	type GetApiReportsMeStatus200,
	useGetApiReportsMe,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	type BadgeVariant,
	Button,
	PageHeading,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { RequireSession } from "@/features/auth/require-session";
import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { myReportAnchorId } from "../routing/report-routes";

type MyReport = GetApiReportsMeStatus200["items"][number];

const MyReportStatusBadgeVariants = {
	submitted: "secondary",
	reviewing: "info",
	completed: "success",
	merged: "outline",
	not_actioned: "warning",
} as const satisfies Record<MyReport["status"], BadgeVariant>;

function formatReportDate(value: string, locale: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat(locale, {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(date);
}

export function MyReportsPage({ selectedReportId }: { readonly selectedReportId?: string }) {
	return (
		<RequireSession>
			<MyReportsContent selectedReportId={selectedReportId} />
		</RequireSession>
	);
}

function MyReportsContent({ selectedReportId }: { readonly selectedReportId?: string }) {
	const { t, locale } = useTranslation(["reports", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const baseQuery = {
		limit: 30,
		localizationLanguages,
	} satisfies GetApiReportsMeQuery;
	const reports = useInfiniteQuery({
		queryKey: getApiReportsMeQueryKey({ query: baseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiReportsMe({
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const selectedReport = useGetApiReportsMe(
		{
			query: {
				limit: 1,
				localizationLanguages,
				...(selectedReportId ? { reportId: selectedReportId } : {}),
			},
		},
		{ query: { enabled: Boolean(selectedReportId) } },
	);

	if (reports.isPending || (selectedReportId && selectedReport.isPending)) return <QueryPending />;
	if (reports.isError || selectedReport.isError)
		return (
			<QueryFailure
				error={reports.error ?? selectedReport.error}
				retry={() => {
					void reports.refetch();
					if (selectedReportId) void selectedReport.refetch();
				}}
			/>
		);

	const selected = selectedReport.data?.items[0];
	const listed = reports.data.pages.flatMap((page) => page.items);
	const items = selected ? [selected, ...listed.filter((item) => item.id !== selected.id)] : listed;
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 py-8 sm:px-6 sm:py-10">
			<PageHeading
				description={t.reports.myReports.description}
				title={t.reports.myReports.title}
			/>

			{items.length ? (
				<div className="divide-y divide-border-weak border-y border-border-weak">
					{items.map((item) => {
						const target = item.target.state === "available" ? item.target.unit : undefined;
						const href = target ? publicUnitHref(target.kind, target) : undefined;
						const targetTitle = target
							? (target.title ?? t.ui.unnamed)
							: t.reports.myReports.targetUnavailable;
						return (
							<article
								className="scroll-mt-24 py-5 [content-visibility:auto] [contain-intrinsic-size:auto_14rem]"
								id={myReportAnchorId(item.id)}
								key={item.id}
							>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="min-w-0 flex-1">
										<h2 className="font-medium text-base">
											{href ? (
												<Link
													className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
													href={href}
												>
													{targetTitle}
												</Link>
											) : (
												targetTitle
											)}
										</h2>
										<time
											className="mt-1 block text-muted-foreground text-xs"
											dateTime={item.createdAt}
										>
											{t.reports.myReports.submittedAt({
												date: formatReportDate(item.createdAt, locale.current),
											})}
										</time>
									</div>
									<Badge variant={MyReportStatusBadgeVariants[item.status]}>
										{t.reports.myReports.statuses[item.status]}
									</Badge>
								</div>

								<dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
									<div>
										<dt className="text-muted-foreground">{t.reports.myReports.scope}</dt>
										<dd className="mt-2 grid gap-2">
											{item.referrals.map((referral) => (
												<div className="flex flex-wrap items-center gap-2" key={referral.id}>
													<span className="font-medium">
														{referral.destinationTitle ??
															t.reports.myReports.scopes[referral.scope]}
													</span>
													<Badge variant={MyReportStatusBadgeVariants[referral.status]}>
														{t.reports.myReports.statuses[referral.status]}
													</Badge>
													<span className="text-muted-foreground text-xs">
														{t.reports.caseStates[referral.caseState]}
													</span>
												</div>
											))}
										</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">{t.reports.myReports.rule}</dt>
										<dd className="mt-2 grid gap-1">
											{item.rules.map((rule) => (
												<span className="font-medium" key={rule.id}>
													{rule.title}
												</span>
											))}
										</dd>
									</div>
									{item.details ? (
										<div className="sm:col-span-2">
											<dt className="text-muted-foreground">{t.reports.myReports.details}</dt>
											<dd className="mt-1 whitespace-pre-wrap break-words leading-6">
												{item.details}
											</dd>
										</div>
									) : null}
								</dl>
							</article>
						);
					})}
				</div>
			) : (
				<div className="rounded-xl border border-border-weak px-6 py-10 text-center">
					<h2 className="font-medium">{t.reports.myReports.emptyTitle}</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						{t.reports.myReports.emptyDescription}
					</p>
				</div>
			)}

			{reports.hasNextPage ? (
				<Button
					className="self-center"
					disabled={reports.isFetchingNextPage}
					isLoading={reports.isFetchingNextPage}
					onClick={() => void reports.fetchNextPage()}
					variant="outline"
				>
					{t.reports.myReports.loadMore}
				</Button>
			) : null}
		</main>
	);
}
