"use client";

import { useGetUserProfileActivity } from "@rezics/openapi-tanstack-query";
import { Badge, Card, CardContent, QueryFailure, QueryPending } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { clampProgress, toProgressStatus } from "@/features/progress/model/progress-record";
import { isCatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { catalogDetailHref } from "@/features/units/routing/catalog-detail-routes";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { useProfileContext } from "./profile-layout";

export function ProfileActivityPage() {
	const { t, locale } = useTranslation(["profiles", "ui"]);
	const { profile, isCurrentUser } = useProfileContext();
	const localizationLanguages = useLocalizationLanguages();
	const activity = useGetUserProfileActivity({
		path: { id: profile.id },
		query: { localizationLanguages, limit: 30 },
	});
	if (activity.isPending) return <QueryPending />;
	if (activity.isError || !activity.data)
		return <QueryFailure error={activity.error} retry={() => void activity.refetch()} />;
	const empty = activity.data.scores.length === 0 && activity.data.progress.length === 0;
	const dateFormatter = new Intl.DateTimeFormat(locale.target, { dateStyle: "medium" });

	return (
		<section aria-labelledby="profile-activity-title" className="max-w-3xl">
			<div>
				<h2 className="font-heading font-bold text-2xl" id="profile-activity-title">
					{t.profiles.activityTitle}
				</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-6">
					{t.profiles.activityDescription}
				</p>
			</div>

			{empty ? (
				<Card appearance="outlined" className="mt-6">
					<CardContent className="p-6 text-muted-foreground text-sm">
						{t.profiles.activityEmpty}
					</CardContent>
				</Card>
			) : (
				<div className="mt-6 grid gap-8">
					{activity.data.scores.length ? (
						<section aria-labelledby="profile-scores-title">
							<h3
								className="font-heading font-semibold text-lg"
								id="profile-scores-title"
							>
								{t.profiles.activityScores}
							</h3>
							<div className="mt-3 grid gap-3">
								{activity.data.scores.map((item) => {
									const href = isCatalogDetailUnitType(item.unitKind)
										? catalogDetailHref(item.unitKind, item.unitId)
										: undefined;
									const title = item.unitTitle ?? t.ui.unnamed;
									return (
										<Card appearance="outlined" key={item.scoreId}>
											<CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
												<div className="min-w-0">
													{href ? (
														<Link
															className="font-medium hover:underline"
															href={href}
														>
															{title}
														</Link>
													) : (
														<p className="font-medium">{title}</p>
													)}
													<p className="mt-1 text-muted-foreground text-sm">
														{t.profiles.activityScoreContext({
															context:
																item.contextTitle ??
																item.contextUnitId,
														})}
													</p>
													<p className="mt-1 text-muted-foreground text-xs">
														{dateFormatter.format(
															new Date(item.updatedAt),
														)}
													</p>
												</div>
												<div className="flex items-center gap-2">
													<span className="font-heading font-bold text-xl">
														{t.profiles.activityScoreValue({
															value: toNonNegativeApiInteger(
																item.value,
															),
														})}
													</span>
													{isCurrentUser ? (
														<Badge variant="secondary">
															{t.ui[item.visibility]}
														</Badge>
													) : null}
												</div>
											</CardContent>
										</Card>
									);
								})}
							</div>
						</section>
					) : null}

					{activity.data.progress.length ? (
						<section aria-labelledby="profile-progress-title">
							<h3
								className="font-heading font-semibold text-lg"
								id="profile-progress-title"
							>
								{t.profiles.activityProgress}
							</h3>
							<div className="mt-3 grid gap-3">
								{activity.data.progress.map((item) => {
									const href = isCatalogDetailUnitType(item.unitKind)
										? catalogDetailHref(item.unitKind, item.unitId)
										: undefined;
									const title = item.unitTitle ?? t.ui.unnamed;
									const percentage = Math.round(
										clampProgress(item.progress) * 100,
									);
									return (
										<Card appearance="outlined" key={item.unitId}>
											<CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
												<div className="min-w-0">
													{href ? (
														<Link
															className="font-medium hover:underline"
															href={href}
														>
															{title}
														</Link>
													) : (
														<p className="font-medium">{title}</p>
													)}
													<p className="mt-1 text-muted-foreground text-sm">
														{
															t.profiles.progressStatuses[
																toProgressStatus(item.status)
															]
														}{" "}
														·{" "}
														{t.profiles.activityProgressValue({
															percentage,
														})}
													</p>
													<p className="mt-1 text-muted-foreground text-xs">
														{dateFormatter.format(
															new Date(item.lastSeenAt),
														)}
													</p>
												</div>
												{isCurrentUser ? (
													<Badge variant="secondary">
														{t.ui[item.visibility]}
													</Badge>
												) : null}
											</CardContent>
										</Card>
									);
								})}
							</div>
						</section>
					) : null}
				</div>
			)}
		</section>
	);
}
