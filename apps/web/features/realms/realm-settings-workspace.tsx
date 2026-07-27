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
	History,
	KeyRound,
	Pin,
	ScrollText,
	ShieldCheck,
	UserRound,
	UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { RequireSession } from "@/features/auth/require-session";
import { UnitAccessManager } from "@/features/governance/components/unit-access-manager";
import { UnitRevisionCompare } from "@/features/history/components/unit-revision-compare";
import { UnitRevisionHistory } from "@/features/history/components/unit-revision-history";
import { realmHref } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { canOpenRealmSettings, getRealmSettingsSectionIds } from "./realm-permissions";
import { RealmModeration } from "./realm-moderation";
import { RealmMemberAccess } from "./realm-member-access";
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
	memberProfileId,
}: {
	realmId: string;
	baseHref: string;
	section?: RealmSettingsSectionId;
	comparison?: { from: string | null; to: string | null };
	memberProfileId?: string;
}) {
	return (
		<RequireSession>
			<RealmSettingsWorkspaceContent
				baseHref={baseHref}
				comparison={comparison}
				realmId={realmId}
				section={section}
				memberProfileId={memberProfileId}
			/>
		</RequireSession>
	);
}

function RealmSettingsWorkspaceContent({
	realmId,
	baseHref,
	section,
	comparison,
	memberProfileId,
}: {
	realmId: string;
	baseHref: string;
	section?: RealmSettingsSectionId;
	comparison?: { from: string | null; to: string | null };
	memberProfileId?: string;
}) {
	const { t } = useTranslation(["errors", "history", "realms"]);
	const localizationLanguages = useLocalizationLanguages();
	const realm = useGetApiRealmsByRealmId({
		path: { realmId },
		query: { localizationLanguages },
	});
	if (realm.isPending) return <QueryPending />;
	if (realm.isError || !realm.data)
		return <QueryFailure error={realm.error} retry={() => void realm.refetch()} />;
	const capabilities = realm.data.capabilities;
	if (!canOpenRealmSettings(capabilities))
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
	const visibleSectionIds = new Set(getRealmSettingsSectionIds(capabilities));
	const sections = allSections.filter((candidate) => visibleSectionIds.has(candidate.id));
	const sectionAllowed =
		(!section || visibleSectionIds.has(section)) &&
		(!memberProfileId || capabilities.canManageMembers);
	const localization =
		realm.data.localizations.find((item) => item.language === realm.data.language) ??
		realm.data.localizations[0];
	return (
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
					<RealmProfileSettings embedded realm={realm.data} />
				</RealmSettingsSection>
			) : section === "members" ? (
				memberProfileId ? (
					<RealmMemberAccessSection
						baseHref={baseHref}
						profileId={memberProfileId}
						realmId={realmId}
					/>
				) : (
					<RealmMembersSection
						baseHref={baseHref}
						canManage={capabilities.canManageMembers}
						realmId={realmId}
					/>
				)
			) : section === "rules" ? (
				<RealmRulesSection baseHref={baseHref} realmId={realmId} />
			) : section === "pins" ? (
				<RealmPinsSection baseHref={baseHref} realmId={realmId} />
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
	);
}

function RealmMemberAccessSection({
	baseHref,
	realmId,
	profileId,
}: {
	baseHref: string;
	realmId: string;
	profileId: string;
}) {
	const { t } = useTranslation(["realms"]);
	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={realmSettingsSectionHref(baseHref, "members")}
				backLabel={t.realms.memberAccess.backToMembers}
				description={t.realms.memberAccess.description}
				link={Link}
				showBackOnDesktop
				title={t.realms.membersView.editPermissions}
			/>
			<RealmMemberAccess profileId={profileId} realmId={realmId} />
		</section>
	);
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
	const { t } = useTranslation(["realms"]);
	const copy = t.realms.settingsWorkspace.sections[section];
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
				baseHref={baseHref}
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
