"use client";

import { useGetApiEntitiesByUnitId } from "@rezics/openapi-tanstack-query";
import {
	Banner,
	Button,
	Card,
	CardContent,
	Cover,
	IdentityAvatar,
	PageHeading,
	QueryFailure,
	QueryPending,
	ShowMoreContent,
} from "@rezics/ui";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { ContentLanguageVersionMenu } from "@/features/content-languages/components/content-language-version-menu";
import { isCommunityUnitEntityKind } from "@/features/create/model/community-unit-search";
import { EntityOwnershipClaimButton } from "@/features/ownership-claims/components/unit-ownership-claim-actions";
import { profileHref } from "@/features/profiles/profile-route";
import { UnitReportOverflowMenu } from "@/features/reports/components/unit-report-dialog";
import { UnitTagSummary } from "@/features/tags/components/unit-tag-summary";
import { UnitVariantList } from "@/features/units/components/unit-variant-list";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { readPortableText } from "@/lib/block";
import { selectLocalization } from "@/lib/localization";
import { EntityRelatedFeed } from "../components/entity-related-feed";
import { EntityExternalLinks } from "../components/entity-external-links";

export function EntityDetailPage({ id }: { readonly id: string }) {
	const { t } = useTranslation([
		"actions",
		"entities",
		"errors",
		"governance",
		"media",
		"ui",
		"units",
	]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiEntitiesByUnitId({
		path: { unitId: id },
		query: { localizationLanguages },
	});
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId: id,
	});
	const localization = query.data
		? selectLocalization(query.data.localizations, query.data.language ?? "")
		: null;
	const displayedTitle = useChineseContentText(
		localization?.title ?? t.ui.unnamed,
		localization?.title ? localization.language : null,
	);
	const displayedSummary = useChineseContentText(
		localization?.summary ?? "",
		localization?.language,
	);
	const displayedOwnerTitle = useChineseContentText(
		query.data?.owner?.title ?? t.ui.unnamed,
		query.data?.owner?.title ? query.data.owner.language : undefined,
	);

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const avatar = localization?.avatar ?? query.data.avatar;
	const banner = localization?.banner ?? query.data.banner;
	const cover = localization?.cover ?? query.data.cover;
	const entityKindLabel = isCommunityUnitEntityKind(query.data.kind)
		? t.ui[query.data.kind]
		: query.data.kind;
	const canonicalMeasurement = query.data.measurements.find(
		(measurement) => measurement.contextUnitId === null,
	);
	const measurementNumber = new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 1,
	});
	const measurements = canonicalMeasurement
		? [
				canonicalMeasurement.heightMillimetres === null
					? null
					: {
							label: t.entities.height,
							value: `${measurementNumber.format(
								canonicalMeasurement.heightMillimetres / 10,
							)} ${t.entities.centimetreUnit}`,
						},
				canonicalMeasurement.weightGrams === null
					? null
					: {
							label: t.entities.weight,
							value: `${measurementNumber.format(
								canonicalMeasurement.weightGrams / 1_000,
							)} ${t.entities.kilogramUnit}`,
						},
				canonicalMeasurement.bustMillimetres === null
					? null
					: {
							label: t.entities.bust,
							value: `${measurementNumber.format(
								canonicalMeasurement.bustMillimetres / 10,
							)} ${t.entities.centimetreUnit}`,
						},
				canonicalMeasurement.waistMillimetres === null
					? null
					: {
							label: t.entities.waist,
							value: `${measurementNumber.format(
								canonicalMeasurement.waistMillimetres / 10,
							)} ${t.entities.centimetreUnit}`,
						},
				canonicalMeasurement.hipsMillimetres === null
					? null
					: {
							label: t.entities.hips,
							value: `${measurementNumber.format(
								canonicalMeasurement.hipsMillimetres / 10,
							)} ${t.entities.centimetreUnit}`,
						},
			].filter((item): item is { readonly label: string; readonly value: string } => item !== null)
		: [];

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={displayedTitle} />
			{banner ? <Banner alt="" className="rounded-2xl bg-muted" priority src={banner.url} /> : null}
			<Card>
				<CardContent
					className={
						cover
							? "grid items-start gap-5 p-5 sm:grid-cols-[8rem_minmax(0,1fr)]"
							: "grid gap-3 p-5"
					}
				>
					{cover ? (
						<Cover
							alt={displayedTitle}
							className="w-28 rounded-xl border border-border-weak shadow-sm/5 sm:w-full"
							src={cover.url}
						/>
					) : null}
					<div className="grid min-w-0 gap-3 text-sm">
						<IdentityAvatar
							avatar={avatar}
							className="size-20"
							fallback={displayedTitle.slice(0, 1).toUpperCase()}
						/>
						<p>
							<span className="text-muted-foreground">{t.entities.kind}</span> {entityKindLabel}
						</p>
						<p>
							<span className="text-muted-foreground">{t.entities.verification}</span>{" "}
							{query.data.verified ? t.entities.verified : t.entities.unverified}
						</p>
						{query.data.owner ? (
							<p>
								<span className="text-muted-foreground">{t.entities.owner}</span>{" "}
								<Link
									className="underline underline-offset-4"
									href={profileHref({
										id: query.data.owner.id,
										slugAddress: query.data.owner.slugAddress,
									})}
								>
									{displayedOwnerTitle}
								</Link>
							</p>
						) : null}
						{displayedSummary ? <p>{displayedSummary}</p> : null}
						{localization?.description ? (
							<ShowMoreContent
								collapsedClassName="max-h-24 sm:max-h-36"
								showLessLabel={t.ui.showLess}
								showMoreLabel={t.ui.showMore}
							>
								<LocalizedPortableTextContent
									className="prose-p:my-3 prose-p:leading-6 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
									language={localization.language}
									value={readPortableText(localization.description)}
									variant="article"
								/>
							</ShowMoreContent>
						) : null}
						<div className="flex flex-wrap items-center gap-2">
							<EntityOwnershipClaimButton
								ownershipMode={query.data.ownershipMode}
								pendingClaim={query.data.ownershipClaim}
								unitId={query.data.id}
							/>
							{query.data.capabilities.canEdit ? (
								<Button variant="solid" asChild className="w-fit">
									<Link href={`/entities/${query.data.id}/edit`}>{t.ui.edit}</Link>
								</Button>
							) : null}
							{query.data.capabilities.canManageAccess ||
							query.data.capabilities.canEditCreditAttributions ||
							query.data.capabilities.canManageCreditAssociations ||
							query.data.capabilities.canManageSubjectAssociations ? (
								<Button asChild className="w-fit" variant="outline">
									<Link href={`/entities/${query.data.id}/governance`}>{t.governance.open}</Link>
								</Button>
							) : null}
							<UnitReportOverflowMenu
								additionalItems={
									<ContentLanguageVersionMenu
										availableLanguages={query.data.localizations.map(({ language }) => language)}
										currentLanguage={query.data.language}
									/>
								}
								unitId={query.data.id}
							/>
						</div>
					</div>
				</CardContent>
			</Card>
			{measurements.length ? (
				<Card>
					<CardContent className="grid gap-4 p-5">
						<h2 className="font-semibold">{t.entities.measurements}</h2>
						<dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
							{measurements.map((measurement) => (
								<div className="flex items-baseline justify-between gap-4" key={measurement.label}>
									<dt className="text-sm text-muted-foreground">{measurement.label}</dt>
									<dd className="font-medium tabular-nums">{measurement.value}</dd>
								</div>
							))}
						</dl>
					</CardContent>
				</Card>
			) : null}
			<UnitTagSummary type="entity" unitId={query.data.id} />
			<UnitVariantList context={query.data.variantContext} showEmpty={false} />
			<EntityExternalLinks
				entityId={query.data.id}
				initialExternalLinks={query.data.externalLinks}
			/>
			<EntityRelatedFeed entityId={query.data.id} />
		</main>
	);
}
