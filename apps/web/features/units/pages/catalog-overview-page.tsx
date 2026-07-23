"use client";

import { toContentLanguage } from "@rezics/i18n";
import type { Translation } from "@rezics/i18n";
import { PublicationLicenseRegistry } from "@rezics/license";
import {
	Badge,
	Card,
	CardContent,
	DataList,
	DataListItem,
	DataListItemLabel,
	DataListItemValue,
	PortableTextContent,
} from "@rezics/ui";
import Link from "next/link";
import type { ReactNode } from "react";

import { UnitShelf } from "@/features/explore/unit-shelf";
import { UnitProgressPanel } from "@/features/progress/components/unit-progress-panel";
import { useTranslation } from "@/i18n/client";
import { readPortableText } from "@/lib/block";
import { selectLocalization } from "@/lib/localization";
import { isKnownAttributionRole } from "../attribution-role";
import { useCatalogDetail } from "../components/catalog-detail-workspace";
import { publicUnitHref } from "../routing/public-unit-route";

function formatDate(value: string | null, language: string): string | undefined {
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language).format(date);
}

function DetailSection({ children, title }: { children: ReactNode; title: string }) {
	return (
		<section className="grid gap-3">
			<h2 className="font-heading text-xl font-bold">{title}</h2>
			{children}
		</section>
	);
}

export function CatalogOverviewPage() {
	const detail = useCatalogDetail();
	const { locale, t } = useTranslation(["feed", "licenses", "state", "ui", "units"]);
	const { type, unit } = detail;
	const localization = selectLocalization(
		unit.localizations,
		toContentLanguage(locale.target),
		unit.language,
	);
	const licenseDefinition = unit.license ? PublicationLicenseRegistry[unit.license] : null;
	const licenseLabel = unit.license ? t.licenses.options[unit.license].label : null;
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
		[t.units.detail.primaryLanguage, unit.primaryLanguage],
		[t.units.detail.releasedOn, formatDate(unit.releasedOn, locale.current)],
		[t.units.detail.license, licenseValue],
		[t.units.detail.updatedAt, formatDate(unit.updatedAt, locale.current)],
	] as const;
	const domainFacts = getDomainFacts(detail, locale.current, t);

	return (
		<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
			<div className="grid min-w-0 content-start gap-8">
				<DetailSection title={t.ui.summary}>
					<Card>
						<CardContent className="p-6 leading-7 text-muted-foreground">
							{localization?.description ? (
								<div className="prose max-w-none">
									<PortableTextContent
										value={readPortableText(localization.description)}
										variant="article"
									/>
								</div>
							) : (
								(localization?.summary ?? t.state.empty)
							)}
						</CardContent>
					</Card>
				</DetailSection>

				<UnitProgressPanel domain={{ type, unitId: unit.id }} />

				<DetailSection title={t.feed.relatedWorks}>
					<UnitShelf seedUnitId={unit.id} type={type} />
				</DetailSection>
			</div>

			<aside className="grid min-w-0 content-start gap-6">
				<DetailSection title={t.units.detail.information}>
					<Card>
						<CardContent className="p-5">
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
						</CardContent>
					</Card>
				</DetailSection>

				{unit.attributions.length ? (
					<DetailSection title={t.units.detail.credits}>
						<Card>
							<CardContent className="grid gap-2 p-5 text-sm">
								{unit.attributions.map((attribution) => {
									const href = publicUnitHref(
										attribution.creditedUnit.kind,
										attribution.creditedUnit,
									);
									const role = isKnownAttributionRole(attribution.role)
										? t.units.attributionRoles[attribution.role]
										: attribution.role;
									const label = `${attribution.creditedUnit.title ?? t.ui.unnamed} · ${role}`;
									return href ? (
										<Link
											className="min-w-0 break-words text-link hover:text-link-hover hover:underline"
											href={href}
											key={attribution.id}
										>
											{label}
										</Link>
									) : (
										<span key={attribution.id}>{label}</span>
									);
								})}
							</CardContent>
						</Card>
					</DetailSection>
				) : null}

				{unit.tags.length ? (
					<DetailSection title={t.units.detail.tags}>
						<div className="flex flex-wrap gap-2">
							{unit.tags.map((tag) => {
								const label = tag.title ?? tag.tagId;
								const query = new URLSearchParams({
									template: type,
									tag: tag.tagId,
									tagLabel: label,
								});
								return (
									<Link href={`/search?${query.toString()}`} key={tag.id}>
										<Badge variant="outline">{label}</Badge>
									</Link>
								);
							})}
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
