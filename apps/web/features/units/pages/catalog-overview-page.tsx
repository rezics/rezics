"use client";

import type { Translation } from "@rezics/i18n";
import { PublicationLicenseRegistry } from "@rezics/license";
import {
	Card,
	CardContent,
	DataList,
	DataListItem,
	DataListItemLabel,
	DataListItemValue,
} from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import type { ReactNode } from "react";

import { UnitShelf } from "@/features/explore/unit-shelf";
import { UnitRatingsReviewsSection } from "@/features/reviews/components/unit-ratings-reviews-section";
import { UnitProgressSummaryCard } from "@/features/progress/components/unit-progress-summary-card";
import { targetedReviewCreateHref } from "@/features/reviews/routing/review-routes";
import { UnitTagSummary } from "@/features/tags/components/unit-tag-summary";
import { useTranslation } from "@/i18n/client";
import { findPrimaryBookAuthor } from "../attribution-role";
import {
	CompactCreditAttributionGroups,
	PrimaryBookAuthorSection,
} from "../components/catalog-attribution-sections";
import { CatalogSubjectGroups } from "../components/catalog-subject-groups";
import { useCatalogDetail } from "../components/catalog-detail-workspace";
import { catalogCreditsHref, catalogDetailHref } from "../routing/catalog-detail-routes";

function formatDate(value: string | null, language: string): string | undefined {
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language).format(date);
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
	return (
		<section className="grid gap-2.5">
			<h2 className="font-heading text-lg font-bold sm:text-xl">{title}</h2>
			{children}
		</section>
	);
}

export function CatalogOverviewPage() {
	const detail = useCatalogDetail();
	const { locale, t } = useTranslation(["feed", "licenses", "ui", "units"]);
	const { type, unit } = detail;
	const licenseDefinition = unit.license ? PublicationLicenseRegistry[unit.license] : null;
	const licenseLabel = unit.license ? t.licenses.options[unit.license].label : null;
	const contentRating =
		unit.contentRating === "r15"
			? t.units.rating.r15
			: unit.contentRating === "r18"
				? t.units.rating.r18
				: unit.contentRating === "r18g"
					? t.units.rating.r18g
					: t.units.rating.general;
	const aiDisclosure =
		unit.aiDisclosure === "none"
			? t.units.aiDisclosure.none
			: unit.aiDisclosure === "ai_assisted"
				? t.units.aiDisclosure.ai_assisted
				: unit.aiDisclosure === "ai_originated"
					? t.units.aiDisclosure.ai_originated
					: unit.aiDisclosure === "machine_generated"
						? t.units.aiDisclosure.machine_generated
						: t.units.aiDisclosure.unknown;
	const licenseValue =
		licenseDefinition?.kind === "license" ? (
			<a
				aria-label={`${t.licenses.viewTerms}: ${licenseLabel}`}
				className="text-link hover:text-link-hover hover:underline"
				href={licenseDefinition.url}
				rel="noreferrer"
				target="_blank"
			>
				{licenseLabel}
			</a>
		) : (
			licenseLabel
		);
	const commonFacts = [
		[t.units.detail.type, t.units.types[type]],
		[t.ui.contentRating, contentRating],
		[t.units.detail.aiDisclosure, aiDisclosure],
		[
			t.ui.status,
			unit.status === "published"
				? t.ui.published
				: unit.status === "archived"
					? t.ui.archived
					: t.ui.draft,
		],
		[
			t.ui.visibility,
			unit.visibility === "private"
				? t.ui.private
				: unit.visibility === "unlisted"
					? t.ui.unlisted
					: t.ui.public,
		],
		[t.units.detail.releasedOn, formatDate(unit.releasedOn, locale.current)],
		[t.units.detail.license, licenseValue],
		[t.units.detail.updatedAt, formatDate(unit.updatedAt, locale.current)],
	] as const;
	const domainFacts = getDomainFacts(detail, locale.current, t);
	const primaryAuthor = type === "book" ? findPrimaryBookAuthor(unit.attributions) : undefined;
	const creditsHref = catalogCreditsHref(type, unit.id);

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
			<div className="grid min-w-0 content-start gap-6">
				{primaryAuthor ? <PrimaryBookAuthorSection attribution={primaryAuthor} /> : null}

				<UnitTagSummary type={type} unitId={unit.id} />

				<UnitRatingsReviewsSection
					moreReviewsHref={catalogDetailHref(type, unit.id, "reviews")}
					targetId={unit.id}
					type={type}
					writeReviewHref={targetedReviewCreateHref(type, unit.id)}
				/>

				{unit.subjectAssociations.length ? (
					<DetailSection title={t.units.detail.subjectAssociations}>
						<Card>
							<CardContent className="grid gap-4 p-5 sm:p-6">
								<CatalogSubjectGroups
									associations={unit.subjectAssociations.slice(0, 8)}
								/>
								<Link
									className="w-fit text-sm font-medium text-link hover:text-link-hover hover:underline"
									href={`/units/${type}/${unit.id}/associations`}
								>
									{t.units.detail.viewAssociations}
								</Link>
							</CardContent>
						</Card>
					</DetailSection>
				) : null}

				<DetailSection title={t.feed.relatedWorks}>
					<UnitShelf seedUnitId={unit.id} type={type} />
				</DetailSection>
			</div>

			<aside className="grid min-w-0 content-start gap-5">
				<UnitProgressSummaryCard className="hidden lg:flex" />

				<DetailSection title={t.units.detail.information}>
					<DataList>
						{[...domainFacts, ...commonFacts].map(([label, value]) =>
							value !== null && value !== undefined && value !== "" ? (
								<DataListItem key={label}>
									<DataListItemLabel>{label}</DataListItemLabel>
									<DataListItemValue className="min-w-0 break-words text-end">
										{value}
									</DataListItemValue>
								</DataListItem>
							) : null,
						)}
					</DataList>
				</DetailSection>

				{unit.attributions.length ? (
					<DetailSection title={t.units.detail.credits}>
						<div className="grid gap-4">
							<CompactCreditAttributionGroups attributions={unit.attributions} />
							<Link
								className="w-fit text-sm font-medium text-link hover:text-link-hover hover:underline"
								href={creditsHref}
							>
								{t.units.detail.viewAllCredits}
							</Link>
						</div>
					</DetailSection>
				) : null}
			</aside>
		</div>
	);
}

function getDomainFacts(
	detail: ReturnType<typeof useCatalogDetail>,
	language: string,
	t: Pick<Translation, "units">,
): readonly (readonly [string, ReactNode])[] {
	switch (detail.type) {
		case "book":
			return [
				[t.units.fields.isbn13, detail.unit.details.isbn13],
				[
					t.units.fields.publicationDate,
					formatDate(detail.unit.details.publicationDate, language),
				],
				[t.units.fields.pageCount, detail.unit.details.pageCount],
				[t.units.fields.format, detail.unit.details.format],
				[
					t.units.fields.licensed,
					detail.unit.details.licensed ? t.units.fields.yes : t.units.fields.no,
				],
			];
		case "media":
			return [
				[t.units.fields.mediaKind, detail.unit.details.kind],
				[t.units.fields.releaseDate, formatDate(detail.unit.details.releaseDate, language)],
				[t.units.fields.runtimeMinutes, detail.unit.details.runtimeMinutes],
				[t.units.fields.episodeCount, detail.unit.details.episodeCount],
				[t.units.fields.seasonCount, detail.unit.details.seasonCount],
				[
					t.units.fields.licensed,
					detail.unit.details.licensed ? t.units.fields.yes : t.units.fields.no,
				],
			];
		case "software":
			return [
				[t.units.fields.releaseDate, formatDate(detail.unit.details.releaseDate, language)],
				[t.units.fields.versionLabel, detail.unit.details.versionLabel],
				[
					t.units.fields.licensed,
					detail.unit.details.licensed ? t.units.fields.yes : t.units.fields.no,
				],
			];
	}
}
