"use client";

import { Bookmark, Gauge, Globe2, House, PanelsTopLeft } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { FontAwesomeProvider } from "@rezics/avatar";
import {
	getApiUsersMePreferencesQueryKey,
	useGetApiUsersMe,
	useGetApiUsersMeFollowing,
	usePatchApiUsersMePreferences,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell as SharedAppShell, Button } from "@rezics/ui";
import { toStoredUiLocale, toUiLocale, UiLocaleValues } from "@rezics/i18n";
import { OfficialZoneUnitIds } from "@rezics/slug";

import { followingManagementHref } from "@/features/following/routing/following-route";
import { ChineseContentDisplayProvider } from "@/features/content-language-display/chinese-content-display-context";
import {
	setPresentationPreferencesQueryData,
	usePresentationPreferences,
} from "@/features/preferences/data/use-presentation-preferences";
import { useSetLocale, useTranslation } from "@/i18n/client";
import { useLocalizationLanguageState } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { AppLink } from "./components/app-link";
import {
	RestoringHeaderActions,
	SignedInHeaderActions,
	SignedOutHeaderActions,
} from "./components/header-actions";
import { HeaderSearchProvider, useCurrentHeaderSearch } from "./header-search";
import { useThemePreference } from "./hooks/use-theme-preference";
import { sidebarFollowingHref } from "./routing/sidebar-following";

const Links = [
	{ href: "/", key: "home", icon: House },
	{ href: "/create", key: "studio", icon: PanelsTopLeft },
	{ href: "/me/favorites", key: "favorites", icon: Bookmark },
	{ href: "/me/progress", key: "progress", icon: Gauge },
] as const;

type OfficialZoneKey = keyof typeof OfficialZoneUnitIds;

const AnonymousSidebarZoneKeys = [
	"book",
	"media",
	"software",
	"realm",
	"zone",
] as const satisfies readonly OfficialZoneKey[];

const OfficialZoneAvatarNames = {
	book: "book-open",
	media: "clapperboard",
	software: "code",
	realm: "people-group",
	zone: "compass",
} as const satisfies Record<OfficialZoneKey, string>;

export function ApplicationShell({ children }: { children: ReactNode }) {
	return (
		<HeaderSearchProvider>
			<ApplicationShellContent>{children}</ApplicationShellContent>
		</HeaderSearchProvider>
	);
}

function ApplicationShellContent({ children }: { readonly children: ReactNode }) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const headerSearch = useCurrentHeaderSearch();
	const authSession = useHydratedSession();
	const session = authSession.data;
	const { t, locale } = useTranslation([
		"actions",
		"auth",
		"betterAuthErrorCodes",
		"brand",
		"errorCodes",
		"errors",
		"locale",
		"nav",
		"search",
		"ui",
	]);
	const { setLocale } = useSetLocale();
	const theme = useThemePreference();
	const localeChangedByUser = useRef(false);
	const queryClient = useQueryClient();
	const currentProfile = useGetApiUsersMe({}, { query: { enabled: Boolean(session) } });
	const preferences = usePresentationPreferences();
	const localizationState = useLocalizationLanguageState();
	const localizationLanguages =
		localizationState.status === "ready" ? localizationState.languages : [];
	const followedZones = useGetApiUsersMeFollowing(
		{ query: { kind: "zone", localizationLanguages, limit: 50 } },
		{
			query: {
				enabled: Boolean(session) && localizationState.status === "ready",
			},
		},
	);
	const followedRealms = useGetApiUsersMeFollowing(
		{ query: { kind: "realm", localizationLanguages, limit: 50 } },
		{
			query: {
				enabled: Boolean(session) && localizationState.status === "ready",
			},
		},
	);
	const updateInterfaceLocale = usePatchApiUsersMePreferences({
		mutation: {
			scope: { id: "interface-locale" },
			onSuccess: (data) => {
				queryClient.setQueryData(getApiUsersMePreferencesQueryKey(), data);
				if (session)
					setPresentationPreferencesQueryData(queryClient, session.user.id, data);
			},
		},
	});
	const localeSelection = {
		label: t.locale.label,
		value: locale.target,
		options: UiLocaleValues.map((value) => ({
			value,
			label: t.locale.uiLocales[value],
		})),
		onChange: (nextLocale: typeof locale.target) => {
			localeChangedByUser.current = true;
			updateInterfaceLocale.reset();
			setLocale(nextLocale);
			if (session)
				updateInterfaceLocale.mutate({
					body: { interfaceLocale: toStoredUiLocale(nextLocale) },
				});
		},
		isPending: updateInterfaceLocale.isPending,
	} as const;
	const zoneItems = (followedZones.data?.items ?? []).flatMap((item) =>
		item.kind === "zone"
			? [
					{
						id: item.id,
						href: sidebarFollowingHref("zone", item),
						label: item.title ?? t.ui.unnamed,
						avatar: item.avatar,
						favorite: item.favorite,
					},
				]
			: [],
	);
	const realmItems = (followedRealms.data?.items ?? []).flatMap((item) =>
		item.kind === "realm"
			? [
					{
						id: item.id,
						href: sidebarFollowingHref("realm", item),
						label: item.title ?? t.ui.unnamed,
						avatar:
							item.avatar ??
							(item.cover ? { type: "image", image: item.cover } : null),
						favorite: item.favorite,
					},
				]
			: [],
	);
	const anonymousZoneItems = AnonymousSidebarZoneKeys.map((key) => {
		const unitId = OfficialZoneUnitIds[key];
		return {
			id: unitId,
			href: sidebarFollowingHref("zone", unitId),
			label: t.nav.following.types[key],
			avatar: {
				type: "icon",
				icon: {
					provider: FontAwesomeProvider,
					prefix: "fas",
					name: OfficialZoneAvatarNames[key],
				},
			},
		} as const;
	});

	useEffect(() => {
		localeChangedByUser.current = false;
	}, [session?.user.id]);

	useEffect(() => {
		if (localeChangedByUser.current) return;
		const storedLocale = preferences.data?.interfaceLocale;
		if (
			!storedLocale ||
			!currentProfile.data?.id ||
			preferences.data?.profileId !== currentProfile.data.id
		)
			return;
		setLocale(toUiLocale(storedLocale));
	}, [
		currentProfile.data?.id,
		preferences.data?.interfaceLocale,
		preferences.data?.profileId,
		setLocale,
	]);

	const chineseContentDisplay = preferences.data?.chineseContentDisplay ?? "original";

	if (/^\/units\/book\/[^/]+\/read\/[^/]+$/.test(pathname))
		return (
			<ChineseContentDisplayProvider value={chineseContentDisplay}>
				{children}
			</ChineseContentDisplayProvider>
		);

	return (
		<ChineseContentDisplayProvider value={chineseContentDisplay}>
			<SharedAppShell
				brandName={t.brand.name}
				currentPath={pathname}
				currentSearch={searchParams.toString()}
				headerActions={
					session ? (
						<SignedInHeaderActions
							createLabel={t.actions.create}
							fallbackName={session.user.name}
							locale={localeSelection}
							profile={currentProfile.data}
							theme={{
								preference: theme.preference,
								onChange: theme.setPreference,
							}}
						/>
					) : (
						<>
							{authSession.status === "anonymous" ? (
								<SignedOutHeaderActions
									locale={localeSelection}
									loginLabel={t.actions.login}
									signupLabel={t.auth.createAccount}
									theme={{
										preference: theme.preference,
										onChange: theme.setPreference,
									}}
								/>
							) : (
								<RestoringHeaderActions />
							)}
						</>
					)
				}
				link={AppLink}
				navigationLabel={t.nav.navigation}
				sidebar={{
					title: t.nav.sidebar.title,
					description: t.nav.sidebar.description,
					open: t.nav.sidebar.open,
					close: t.nav.sidebar.close,
					expand: t.nav.sidebar.expand,
					collapse: t.nav.sidebar.collapse,
				}}
				search={{
					href: headerSearch?.href ?? "/search",
					label: headerSearch?.label ?? t.search.site.label,
					placeholder: headerSearch?.placeholder ?? t.search.site.placeholder,
					avatar: headerSearch?.avatar,
					avatarFallback: headerSearch?.avatarFallback,
					defaultValue: searchParams.get("q") ?? "",
				}}
				skipToContentLabel={t.nav.skipToContent}
				navigation={Links.map(({ href, key, icon }) => ({
					href,
					label: t.nav[key],
					icon,
				}))}
				sidebarSupplement={
					session
						? {
								kind: "following",
								content: {
									groups: [
										{
											id: "zone",
											label: t.nav.sidebar.zones,
											allLabel: t.nav.sidebar.allZones,
											allHref: followingManagementHref("zone"),
											emptyLabel: t.nav.sidebar.zonesEmpty,
											icon: PanelsTopLeft,
											isLoading:
												localizationState.status === "restoring" ||
												followedZones.isPending,
											isError:
												localizationState.status === "error" ||
												followedZones.isError,
											items: zoneItems,
										},
										{
											id: "realm",
											label: t.nav.sidebar.realms,
											allLabel: t.nav.sidebar.allRealms,
											allHref: followingManagementHref("realm"),
											emptyLabel: t.nav.sidebar.realmsEmpty,
											icon: Globe2,
											isLoading:
												localizationState.status === "restoring" ||
												followedRealms.isPending,
											isError:
												localizationState.status === "error" ||
												followedRealms.isError,
											items: realmItems,
										},
									],
									loadingLabel: t.nav.sidebar.loading,
									errorLabel: t.nav.sidebar.error,
								},
							}
						: authSession.status === "anonymous"
							? { kind: "shortcuts", items: anonymousZoneItems }
							: undefined
				}
			>
				{children}
			</SharedAppShell>
			{authSession.status === "error" || updateInterfaceLocale.error ? (
				<div className="pointer-events-none fixed inset-x-4 top-16 z-[60] flex flex-col items-end gap-2">
					{authSession.status === "error" ? (
						<div className="pointer-events-auto max-w-sm rounded-xl border border-destructive/30 bg-background px-4 py-3 shadow-lg">
							<RequestFailure error={authSession.error} fallback={t.ui.retryLater} />
							<Button
								className="mt-2"
								onClick={() => void authSession.refetch()}
								size="sm"
								variant="quiet"
							>
								{t.actions.retry}
							</Button>
						</div>
					) : null}
					{updateInterfaceLocale.error ? (
						<div className="max-w-sm rounded-xl border border-destructive/30 bg-background px-4 py-3 shadow-lg">
							<RequestFailure
								error={updateInterfaceLocale.error}
								fallback={t.ui.retryLater}
							/>
						</div>
					) : null}
				</div>
			) : null}
		</ChineseContentDisplayProvider>
	);
}
