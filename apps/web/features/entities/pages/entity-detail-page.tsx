"use client";

import { useGetApiEntitiesByUnitId } from "@rezics/openapi-tanstack-query";
import {
	Banner,
	Button,
	Card,
	CardContent,
	IdentityAvatar,
	PageHeading,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { ContentLanguageVersionMenu } from "@/features/content-languages/components/content-language-version-menu";
import { isCommunityUnitEntityKind } from "@/features/create/model/community-unit-search";
import { EntityOwnershipClaimButton } from "@/features/ownership-claims/components/unit-ownership-claim-actions";
import { profileHref } from "@/features/profiles/profile-route";
import { UnitReportOverflowMenu } from "@/features/reports/components/unit-report-dialog";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
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
	const entityKindLabel = isCommunityUnitEntityKind(query.data.kind)
		? t.ui[query.data.kind]
		: query.data.kind;

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={displayedTitle} />
			{banner ? (
				<Banner alt="" className="rounded-2xl bg-muted" priority src={banner.url} />
			) : null}
			<Card>
				<CardContent className="grid gap-3 p-5 text-sm">
					<IdentityAvatar
						avatar={avatar}
						className="size-20"
						fallback={displayedTitle.slice(0, 1).toUpperCase()}
					/>
					<p>
						<span className="text-muted-foreground">{t.entities.kind}</span>{" "}
						{entityKindLabel}
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
								<Link href={`/entities/${query.data.id}/governance`}>
									{t.governance.open}
								</Link>
							</Button>
						) : null}
						<UnitReportOverflowMenu
							additionalItems={
								<ContentLanguageVersionMenu
									availableLanguages={query.data.localizations.map(
										({ language }) => language,
									)}
									currentLanguage={query.data.language}
								/>
							}
							unitId={query.data.id}
						/>
					</div>
				</CardContent>
			</Card>
			<EntityExternalLinks
				entityId={query.data.id}
				initialExternalLinks={query.data.externalLinks}
			/>
			<EntityRelatedFeed entityId={query.data.id} />
		</main>
	);
}
