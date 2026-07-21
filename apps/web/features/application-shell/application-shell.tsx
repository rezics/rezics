"use client";

import { Compass, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, useEffect, type ComponentPropsWithoutRef, type ReactNode } from "react";
import {
	getApiUsersMePreferencesQueryKey,
	useGetApiUsersMe,
	useGetApiUsersMePreferences,
	useGetApiUsersMeFollowing,
	usePutApiUsersMePreferences,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell as SharedAppShell } from "@rezics/ui";
import { isUiLocale, toContentLanguage, toStoredUiLocale, toUiLocale } from "@rezics/i18n";

import { useAuthPortal } from "@/features/auth/auth-portal";
import { profileHref } from "@/features/profiles/profile-route";
import { useSetLocale, useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { isSidebarFollowingKind, sidebarFollowingHref } from "./sidebar-following";
import { ThemeToggle } from "./theme-toggle";

const Links = [{ href: "/", key: "explore", icon: Compass }] as const;

type AppLinkProps = ComponentPropsWithoutRef<typeof Link>;

const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink(
	{ href, onClick, ...props },
	ref,
) {
	const { openAuthPortal } = useAuthPortal();
	return (
		<Link
			{...props}
			href={href}
			onClick={(event) => {
				onClick?.(event);
				if (
					event.defaultPrevented ||
					event.button !== 0 ||
					event.metaKey ||
					event.ctrlKey ||
					event.shiftKey ||
					event.altKey ||
					(event.currentTarget.target && event.currentTarget.target !== "_self") ||
					typeof href !== "string"
				)
					return;
				const [pathname] = href.split("?", 1);
				if (pathname !== "/login") return;
				event.preventDefault();
				openAuthPortal("login", {
					destination: href === "/login?next=/create" ? "/create" : undefined,
				});
			}}
			ref={ref}
		/>
	);
});

export function ApplicationShell({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const { data: session } = useHydratedSession();
	const { t, locale } = useTranslation([
		"actions",
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
	const queryClient = useQueryClient();
	const currentProfile = useGetApiUsersMe({ query: { enabled: Boolean(session) } });
	const preferences = useGetApiUsersMePreferences({ query: { enabled: Boolean(session) } });
	const followingLanguage = toContentLanguage(locale.target);
	const followedZones = useGetApiUsersMeFollowing(
		{ query: { kind: "zone", language: followingLanguage, limit: 50 } },
		{ query: { enabled: Boolean(session) } },
	);
	const followedRealms = useGetApiUsersMeFollowing(
		{ query: { kind: "realm", language: followingLanguage, limit: 50 } },
		{ query: { enabled: Boolean(session) } },
	);
	const updatePreferences = usePutApiUsersMePreferences({
		mutation: {
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: getApiUsersMePreferencesQueryKey() }),
		},
	});

	useEffect(() => {
		const storedLocale = preferences.data?.interfaceLocale;
		if (!storedLocale) return;
		const preferred = toUiLocale(storedLocale);
		if (preferred !== locale.target) setLocale(preferred);
	}, [locale.target, preferences.data?.interfaceLocale, setLocale]);

	if (/^\/units\/book\/[^/]+\/read\/[^/]+$/.test(pathname)) return children;

	return (
		<SharedAppShell
			brandName={t.brand.name}
			account={{
				href: session
					? currentProfile.data
						? profileHref(currentProfile.data)
						: "/settings/profile"
					: "/login",
				label: session ? t.ui.profile : t.actions.login,
				icon: UserRound,
				variant: session ? "ghost" : "brand",
			}}
			create={{
				href: session ? "/create" : "/login?next=/create",
				icon: Plus,
				label: t.actions.create,
			}}
			currentPath={pathname}
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
				href: "/search",
				label: t.actions.search,
				placeholder: t.search.placeholder,
			}}
			skipToContentLabel={t.nav.skipToContent}
			locale={{
				label: t.locale.label,
				onChange: async (nextLocale) => {
					if (!isUiLocale(nextLocale)) return;
					if (preferences.data)
						await updatePreferences.mutateAsync({
							body: {
								interfaceLocale: toStoredUiLocale(nextLocale),
								defaultLicense: preferences.data.defaultLicense,
								defaultRealmManageMode: preferences.data.defaultRealmManageMode,
								collectionConfig: preferences.data.collectionConfig,
								personalizedFeed: preferences.data.personalizedFeed,
								contentRatings: preferences.data.contentRatings.map((value) =>
									value === "r15" || value === "r18" || value === "r18g"
										? value
										: "general",
								),
								preferredLanguages: preferences.data.preferredLanguages,
							},
						});
					setLocale(nextLocale);
				},
				options: [
					{ value: "zh-Hant", label: t.locale.zh },
					{ value: "en", label: t.locale.en },
				],
				value: locale.target,
			}}
			navigation={Links.map(({ href, key, icon }) => ({
				href,
				label: t.nav[key],
				icon,
			}))}
			following={
				session
					? {
							zonesLabel: t.nav.sidebar.zones,
							realmsLabel: t.nav.sidebar.realms,
							zonesEmptyLabel: t.nav.sidebar.zonesEmpty,
							realmsEmptyLabel: t.nav.sidebar.realmsEmpty,
							loadingLabel: t.nav.sidebar.loading,
							errorLabel: t.nav.sidebar.error,
							zonesLoading: followedZones.isPending,
							realmsLoading: followedRealms.isPending,
							zonesError: followedZones.isError,
							realmsError: followedRealms.isError,
							manageLabel: t.nav.following.manage,
							manageHref: "/me/following",
							items: [
								...(followedZones.data?.items ?? []),
								...(followedRealms.data?.items ?? []),
							].flatMap((item) => {
								if (!isSidebarFollowingKind(item.kind)) return [];
								return [
									{
										id: item.id,
										kind: item.kind,
										href: sidebarFollowingHref(item.kind, item),
										label: item.title ?? t.ui.unnamed,
										imageUrl: item.avatar?.url ?? item.cover?.url,
										favorite: item.favorite,
									},
								];
							}),
						}
					: undefined
			}
			utilities={<ThemeToggle />}
		>
			{children}
		</SharedAppShell>
	);
}
