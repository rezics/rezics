"use client";

import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";
import {
	Card,
	CardContent,
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
	IdentityAvatar,
} from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { Fragment } from "react";

import { FollowButton } from "@/features/following/components/follow-button";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { ProfileInfoCard } from "@/features/profiles/components/profile-info-card";
import { useTranslation } from "@/i18n/client";
import { toNonNegativeApiInteger } from "@/lib/api-number";
import { groupByAssociationRole } from "../attribution-role";
import { publicUnitHref } from "../routing/public-unit-route";

type CreditAttribution = GetApiUnitsByTypeByUnitIdStatus200["attributions"][number];

function attributionHref(attribution: CreditAttribution): string | undefined {
	return publicUnitHref(attribution.creditedUnit.kind, attribution.creditedUnit);
}

function AttributionName({
	attribution,
	showInfoCard = false,
}: {
	attribution: CreditAttribution;
	showInfoCard?: boolean;
}) {
	const { t } = useTranslation(["ui"]);
	const href = attributionHref(attribution);
	const sourceName = attribution.creditedUnit.title ?? t.ui.unnamed;
	const name = useChineseContentText(
		sourceName,
		attribution.creditedUnit.title ? attribution.creditedUnit.language : undefined,
	);
	const nameContent = href ? (
		<Link
			className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline"
			href={href}
		>
			{name}
		</Link>
	) : (
		<span className="font-medium">{name}</span>
	);
	if (!showInfoCard || !href) return nameContent;
	return (
		<HoverCard closeDelay={160} openDelay={320} positioning={{ placement: "left-start" }}>
			<HoverCardTrigger asChild>{nameContent}</HoverCardTrigger>
			<HoverCardContent className="w-72">
				<ProfileInfoCard
					profile={{
						id: attribution.creditedUnit.id,
						name: sourceName,
						initials: sourceName.slice(0, 1).toUpperCase(),
						language: attribution.creditedUnit.title
							? attribution.creditedUnit.language
							: undefined,
						avatar: attribution.creditedUnit.avatar,
						slug: attribution.creditedUnit.slugAddress?.slug,
						summary: attribution.creditedUnit.summary ?? undefined,
					}}
				/>
			</HoverCardContent>
		</HoverCard>
	);
}

export function CompactCreditAttributionGroups({
	attributions,
}: {
	attributions: readonly CreditAttribution[];
}) {
	const { t } = useTranslation(["units"]);
	return (
		<div className="grid gap-4">
			{groupByAssociationRole(attributions).map((group) => (
				<section className="grid gap-1.5" key={group.role}>
					<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						{t.units.attributionRoles[group.role]}
					</h3>
					<p className="min-w-0 break-words text-sm">
						{group.items.map((attribution, index) => (
							<Fragment key={attribution.id}>
								{index > 0 ? ", " : null}
								<AttributionName attribution={attribution} showInfoCard />
							</Fragment>
						))}
					</p>
				</section>
			))}
		</div>
	);
}

export function DetailedCreditAttributionGroups({
	attributions,
}: {
	attributions: readonly CreditAttribution[];
}) {
	const { t } = useTranslation(["ui", "units"]);
	return (
		<div className="grid gap-10">
			{groupByAssociationRole(attributions).map((group) => (
				<section className="grid gap-3" key={group.role}>
					<h2 className="font-heading text-xl font-bold">
						{t.units.attributionRoles[group.role]}
					</h2>
					<Card>
						<CardContent className="divide-y divide-border-weak p-0">
							{group.items.map((attribution) => {
								const name = attribution.creditedUnit.title ?? t.ui.unnamed;
								return (
									<article
										className="scroll-mt-6 grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4 p-5"
										id={attribution.id}
										key={attribution.id}
									>
										<IdentityAvatar
											avatar={attribution.creditedUnit.avatar}
											className="size-14"
											fallback={name.slice(0, 1).toUpperCase()}
											imageAlt={name}
										/>
										<div className="grid min-w-0 content-center gap-1">
											<AttributionName attribution={attribution} />
											{attribution.creditedUnit.summary ? (
												<p className="text-sm leading-6 text-muted-foreground">
													{attribution.creditedUnit.summary}
												</p>
											) : null}
										</div>
									</article>
								);
							})}
						</CardContent>
					</Card>
				</section>
			))}
		</div>
	);
}

export function PrimaryBookAuthorSection({ attribution }: { attribution: CreditAttribution }) {
	const { locale, t } = useTranslation(["ui", "units"]);
	const name = attribution.creditedUnit.title ?? t.ui.unnamed;
	const creditedBookCount = toNonNegativeApiInteger(
		attribution.creditedUnit.creditedBookCount.value,
	);
	const creditedBookCountIsExact = attribution.creditedUnit.creditedBookCount.kind === "exact";
	const followerCount = toNonNegativeApiInteger(attribution.creditedUnit.followerCount);
	const numberFormat = new Intl.NumberFormat(locale.target);
	const statistics = t.units.detail.authorStatistics;
	const bookCountLabel =
		creditedBookCountIsExact && creditedBookCount === 1
			? statistics.bookOne
			: statistics.books({
					count: `${creditedBookCountIsExact ? "" : "≥"}${numberFormat.format(creditedBookCount)}`,
				});
	const followerCountLabel =
		followerCount === 1
			? statistics.followerOne
			: statistics.followers({ count: numberFormat.format(followerCount) });
	return (
		<section className="grid gap-2.5">
			<h2 className="font-heading text-lg font-bold sm:text-xl">
				{t.units.detail.aboutAuthor}
			</h2>
			<div className="grid gap-4">
				<div className="flex items-center justify-between gap-4">
					<div className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-4">
						<IdentityAvatar
							avatar={attribution.creditedUnit.avatar}
							className="size-16"
							fallback={name.slice(0, 1).toUpperCase()}
							imageAlt={name}
						/>
						<div className="grid min-w-0 gap-1">
							<AttributionName attribution={attribution} />
							<p className="text-sm tabular-nums text-muted-foreground">
								{bookCountLabel}
								<span aria-hidden="true"> · </span>
								{followerCountLabel}
							</p>
						</div>
					</div>
					<FollowButton
						className="shrink-0"
						size="sm"
						unitId={attribution.creditedUnit.id}
						variant="solid"
					/>
				</div>
				{attribution.creditedUnit.summary ? (
					<p className="leading-7 text-muted-foreground">
						{attribution.creditedUnit.summary}
					</p>
				) : null}
			</div>
		</section>
	);
}
