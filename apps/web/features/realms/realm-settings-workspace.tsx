"use client";

import {
	useGetApiRealmsByRealmId,
	useGetApiRealmsByRealmIdMembers,
	useGetApiRealmsByRealmIdPins,
	useGetApiRealmsByRealmIdRules,
} from "@rezics/openapi-tanstack-query";
import type { ManagementWorkspaceSection } from "@rezics/ui";
import {
	ManagementWorkspace,
	ManagementWorkspaceHeader,
	ManagementWorkspaceNavigation,
	ManagementWorkspaceOverview,
	ManagementWorkspaceSectionHeader,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import {
	BookOpenText,
	History,
	KeyRound,
	LayoutList,
	PanelRight,
	Pin,
	ScrollText,
	ShieldCheck,
	UserRound,
	UsersRound,
	Tags,
} from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { RequireSession } from "@/features/auth/require-session";
import {
	ContentLanguageEditorProvider,
	useContentLanguageEditor,
} from "@/features/content-languages/hooks/use-content-language-editor";
import { UnitDockSettings, useDockManagementAccess } from "@/features/docks";
import { UnitAccessManager } from "@/features/governance/components/unit-access-manager";
import { UnitRevisionCompare } from "@/features/history/components/unit-revision-compare";
import { UnitRevisionHistory } from "@/features/history/components/unit-revision-history";
import { realmHref } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { canOpenRealmSettings, getRealmSettingsSectionIds } from "./realm-permissions";
import { RealmModeration } from "./components/realm-moderation";
import { RealmPagesSettings } from "./components/realm-configuration-settings";
import { RealmTaxonomySettings } from "./components/realm-taxonomy-tree-editor";
import { WikiNavigationSettings } from "./components/wiki-navigation-settings";
import { RealmMembers } from "./realm-members";
import { RealmPins, RealmProfileSettings, RealmRules } from "./realm-settings";
import type { RealmSettingsSectionId } from "./model/realm-settings-section";
import { invalidateRealmDetails } from "./query";
import {
	realmSettingsHistoryCompareHref,
	realmSettingsSectionHref,
} from "./routing/realm-settings-routes";

export function RealmSettingsWorkspacePage({
	realmId,
	baseHref,
	section,
	comparison,
}: {
	realmId: string;
	baseHref: string;
	section?: RealmSettingsSectionId;
	comparison?: { from: string | null; to: string | null };
}) {
	return (
		<RequireSession>
			<RealmSettingsWorkspaceContent
				baseHref={baseHref}
				comparison={comparison}
				realmId={realmId}
				section={section}
			/>
		</RequireSession>
	);
}

function RealmSettingsWorkspaceContent({
	realmId,
	baseHref,
	section,
	comparison,
}: {
	realmId: string;
	baseHref: string;
	section?: RealmSettingsSectionId;
	comparison?: { from: string | null; to: string | null };
}) {
	const { t } = useTranslation(["docks", "errors", "history", "realms"]);
	const localizationLanguages = useLocalizationLanguages();
	const dockAccess = useDockManagementAccess(realmId, "realm");
	const realm = useGetApiRealmsByRealmId({
		path: { realmId },
		query: { localizationLanguages },
	});
	if (realm.isPending) return <QueryPending />;
	if (realm.isError || !realm.data)
		return <QueryFailure error={realm.error} retry={() => void realm.refetch()} />;
	if (dockAccess.pending) return <QueryPending />;
	if (dockAccess.error)
		return <QueryFailure error={dockAccess.error} retry={() => void dockAccess.refetch()} />;
	const capabilities = realm.data.capabilities;
	const canManageDocks = dockAccess.allowedKinds.length > 0;
	if (!canOpenRealmSettings(capabilities, canManageDocks))
		return (
			<p className="mx-auto max-w-4xl px-4 py-10 text-sm text-destructive">
				{t.errors.forbidden}
			</p>
		);
	const labels = t.realms.settingsWorkspace.sections;
	const allSections: ManagementWorkspaceSection<RealmSettingsSectionId>[] = [
		{
			id: "profile",
			href: realmSettingsSectionHref(baseHref, "profile"),
			label: labels.profile.label,
			description: labels.profile.description,
			icon: UserRound,
		},
		{
			id: "pages",
			href: realmSettingsSectionHref(baseHref, "pages"),
			label: labels.pages.label,
			description: labels.pages.description,
			icon: LayoutList,
		},
		{
			id: "wiki",
			href: realmSettingsSectionHref(baseHref, "wiki"),
			label: labels.wiki.label,
			description: labels.wiki.description,
			icon: BookOpenText,
		},
		{
			id: "tags",
			href: realmSettingsSectionHref(baseHref, "tags"),
			label: labels.tags.label,
			description: labels.tags.description,
			icon: Tags,
		},
		{
			id: "members",
			href: realmSettingsSectionHref(baseHref, "members"),
			label: labels.members.label,
			description: labels.members.description,
			icon: UsersRound,
		},
		{
			id: "rules",
			href: realmSettingsSectionHref(baseHref, "rules"),
			label: labels.rules.label,
			description: labels.rules.description,
			icon: ScrollText,
		},
		{
			id: "pins",
			href: realmSettingsSectionHref(baseHref, "pins"),
			label: labels.pins.label,
			description: labels.pins.description,
			icon: Pin,
		},
		{
			id: "docks",
			href: realmSettingsSectionHref(baseHref, "docks"),
			label: t.docks.title,
			description: t.docks.description,
			icon: PanelRight,
		},
		{
			id: "access",
			href: realmSettingsSectionHref(baseHref, "access"),
			label: labels.access.label,
			description: labels.access.description,
			icon: KeyRound,
		},
		{
			id: "moderation",
			href: realmSettingsSectionHref(baseHref, "moderation"),
			label: labels.moderation.label,
			description: labels.moderation.description,
			icon: ShieldCheck,
		},
		{
			id: "history",
			href: realmSettingsSectionHref(baseHref, "history"),
			label: labels.history.label,
			description: labels.history.description,
			icon: History,
		},
	];
	const visibleSectionIds = new Set(getRealmSettingsSectionIds(capabilities, canManageDocks));
	const sections = allSections.filter((candidate) => visibleSectionIds.has(candidate.id));
	const sectionAllowed = !section || visibleSectionIds.has(section);
	const localization =
		realm.data.localizations.find((item) => item.language === realm.data.language) ??
		realm.data.localizations[0];
	return (
		<ContentLanguageEditorProvider
			localizations={realm.data.localizations}
			onLanguagesChanged={async () => {
				await realm.refetch();
			}}
			unitId={realmId}
		>
			<ManagementWorkspace
				header={
					<ManagementWorkspaceHeader
						backHref={realmHref(realm.data)}
						backLabel={t.realms.backToRealm}
						description={t.realms.settingsWorkspace.description}
						link={Link}
						title={localization?.title ?? t.realms.settings}
					/>
				}
				navigation={
					<ManagementWorkspaceNavigation
						ariaLabel={t.realms.settingsWorkspace.navigation}
						currentSectionId={sectionAllowed ? section : undefined}
						link={Link}
						sections={sections}
					/>
				}
			>
				{section && !sectionAllowed ? (
					<RealmSettingsSection baseHref={baseHref} section={section}>
						<p className="text-sm text-destructive">{t.errors.forbidden}</p>
					</RealmSettingsSection>
				) : !section ? (
					<ManagementWorkspaceOverview
						ariaLabel={t.realms.settingsWorkspace.overview}
						link={Link}
						sections={sections}
					/>
				) : section === "profile" ? (
					<RealmSettingsSection baseHref={baseHref} section="profile">
						<RealmProfileSettingsForLanguage realm={realm.data} />
					</RealmSettingsSection>
				) : section === "pages" ? (
					<RealmSettingsSection baseHref={baseHref} section="pages">
						<RealmPagesSettings realm={realm.data} />
					</RealmSettingsSection>
				) : section === "wiki" ? (
					<RealmSettingsSection baseHref={baseHref} section="wiki">
						<WikiNavigationSettings realmId={realmId} />
					</RealmSettingsSection>
				) : section === "tags" ? (
					<RealmSettingsSection baseHref={baseHref} section="tags">
						<RealmTaxonomySettings realmId={realmId} />
					</RealmSettingsSection>
				) : section === "members" ? (
					<RealmMembersSection
						baseHref={baseHref}
						canManage={capabilities.canManageMembers}
						realmId={realmId}
					/>
				) : section === "rules" ? (
					<RealmRulesSection baseHref={baseHref} realmId={realmId} />
				) : section === "pins" ? (
					<RealmPinsSection baseHref={baseHref} realmId={realmId} />
				) : section === "docks" ? (
					<RealmSettingsSection baseHref={baseHref} section="docks">
						<UnitDockSettings
							allowedKinds={dockAccess.allowedKinds}
							ownerKind="realm"
							ownerUnitId={realmId}
						/>
					</RealmSettingsSection>
				) : section === "access" ? (
					<RealmSettingsSection baseHref={baseHref} section="access">
						{capabilities.canManageAccess ? (
							<UnitAccessManager unitId={realmId} />
						) : (
							<p className="text-sm text-destructive">{t.errors.forbidden}</p>
						)}
					</RealmSettingsSection>
				) : section === "moderation" ? (
					<RealmSettingsSection baseHref={baseHref} section="moderation">
						<RealmModeration embedded realmId={realmId} />
					</RealmSettingsSection>
				) : (
					<RealmHistorySection
						baseHref={baseHref}
						comparison={comparison}
						realmId={realmId}
					/>
				)}
			</ManagementWorkspace>
		</ContentLanguageEditorProvider>
	);
}

function RealmProfileSettingsForLanguage({
	realm,
}: {
	readonly realm: Parameters<typeof RealmProfileSettings>[0]["realm"];
}) {
	const { selectedLanguage } = useContentLanguageEditor();
	return <RealmProfileSettings embedded key={`${realm.id}:${selectedLanguage}`} realm={realm} />;
}

function RealmSettingsSection({
	baseHref,
	section,
	children,
}: {
	baseHref: string;
	section: RealmSettingsSectionId;
	children: ReactNode;
}) {
	const { t } = useTranslation(["docks", "realms"]);
	const copy =
		section === "docks"
			? { label: t.docks.title, description: t.docks.description }
			: t.realms.settingsWorkspace.sections[section];
	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={baseHref}
				backLabel={t.realms.settingsWorkspace.backToOverview}
				description={copy.description}
				link={Link}
				title={copy.label}
			/>
			{children}
		</section>
	);
}

function RealmMembersSection({
	baseHref,
	realmId,
	canManage,
}: {
	baseHref: string;
	realmId: string;
	canManage: boolean;
}) {
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiRealmsByRealmIdMembers({
		path: { realmId },
		query: { limit: 100, localizationLanguages },
	});
	return (
		<RealmSettingsSection baseHref={baseHref} section="members">
			<RealmMembers
				canManage={canManage}
				error={query.error}
				members={query.data?.items}
				pending={query.isPending}
				realmId={realmId}
			/>
		</RealmSettingsSection>
	);
}

function RealmRulesSection({ baseHref, realmId }: { baseHref: string; realmId: string }) {
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiRealmsByRealmIdRules({
		path: { realmId },
		query: { localizationLanguages },
	});
	return (
		<RealmSettingsSection baseHref={baseHref} section="rules">
			<RealmRules
				embedded
				data={query.data}
				error={query.error}
				pending={query.isPending}
				realmId={realmId}
			/>
		</RealmSettingsSection>
	);
}

function RealmPinsSection({ baseHref, realmId }: { baseHref: string; realmId: string }) {
	const query = useGetApiRealmsByRealmIdPins({ path: { realmId } });
	return (
		<RealmSettingsSection baseHref={baseHref} section="pins">
			<RealmPins
				embedded
				error={query.error}
				pending={query.isPending}
				pins={query.data?.items}
				realmId={realmId}
			/>
		</RealmSettingsSection>
	);
}

function RealmHistorySection({
	realmId,
	baseHref,
	comparison,
}: {
	realmId: string;
	baseHref: string;
	comparison?: { from: string | null; to: string | null };
}) {
	const { t } = useTranslation(["errors", "history"]);
	const queryClient = useQueryClient();
	return (
		<RealmSettingsSection baseHref={baseHref} section="history">
			{comparison ? (
				comparison.from && comparison.to ? (
					<UnitRevisionCompare
						from={comparison.from}
						to={comparison.to}
						unitId={realmId}
					/>
				) : (
					<p className="text-sm text-destructive">{t.errors.invalid}</p>
				)
			) : (
				<UnitRevisionHistory
					compareHref={(from, to) =>
						`${realmSettingsHistoryCompareHref(baseHref)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
					}
					onChanged={() => invalidateRealmDetails(queryClient, realmId)}
					unitId={realmId}
				/>
			)}
		</RealmSettingsSection>
	);
}
