"use client";

import { Bookmark, Gauge, Globe2, House, PanelsTopLeft, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
	forwardRef,
	useEffect,
	useRef,
	type ComponentPropsWithoutRef,
	type ReactNode,
} from "react";
import {
	getApiUsersMePreferencesQueryKey,
	useGetApiUsersMe,
	useGetApiUsersMePreferences,
	useGetApiUsersMeFollowing,
	usePatchApiUsersMePreferences,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell as SharedAppShell } from "@rezics/ui";
import { isUiLocale, toContentLanguage, toStoredUiLocale, toUiLocale } from "@rezics/i18n";

import { useAuthPortal } from "@/features/auth/auth-portal";
import { followingManagementHref } from "@/features/following/routing/following-route";
import { profileHref } from "@/features/profiles/profile-route";
import { useSetLocale, useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { sidebarFollowingHref } from "./sidebar-following";
import { ThemeToggle } from "./theme-toggle";

const Links = [
	{ href: "/", key: "home", icon: House },
	{ href: "/create", key: "studio", icon: PanelsTopLeft },
	{ href: "/me/favorites", key: "favorites", icon: Bookmark },
	{ href: "/me/progress", key: "progress", icon: Gauge },
] as const;

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
	const searchParams = useSearchParams();
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
	const localeChangedByUser = useRef(false);
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
	const updateInterfaceLocale = usePatchApiUsersMePreferences({
		mutation: {
			scope: { id: "interface-locale" },
			onSuccess: (data) => queryClient.setQueryData(getApiUsersMePreferencesQueryKey(), data),
		},
	});
	const zoneItems = (followedZones.data?.items ?? []).flatMap((item) =>
		item.kind === "zone"
			? [
					{
						id: item.id,
						href: sidebarFollowingHref("zone", item),
						label: item.title ?? t.ui.unnamed,
						imageUrl: item.avatar?.url ?? item.cover?.url,
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
						imageUrl: item.avatar?.url ?? item.cover?.url,
						favorite: item.favorite,
					},
				]
			: [],
	);

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

	if (/^\/units\/book\/[^/]+\/read\/[^/]+$/.test(pathname)) return children;

	return (
		<>
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
				currentSearch={searchParams.toString()}
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
					onChange: (nextLocale) => {
						if (!isUiLocale(nextLocale)) return;
						localeChangedByUser.current = true;
						updateInterfaceLocale.reset();
						setLocale(nextLocale);
						if (session)
							updateInterfaceLocale.mutate({
								body: { interfaceLocale: toStoredUiLocale(nextLocale) },
							});
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
								groups: [
									{
										id: "zone",
										label: t.nav.sidebar.zones,
										allLabel: t.nav.sidebar.allZones,
										allHref: followingManagementHref("zone"),
										emptyLabel: t.nav.sidebar.zonesEmpty,
										icon: PanelsTopLeft,
										isLoading: followedZones.isPending,
										isError: followedZones.isError,
										items: zoneItems,
									},
									{
										id: "realm",
										label: t.nav.sidebar.realms,
										allLabel: t.nav.sidebar.allRealms,
										allHref: followingManagementHref("realm"),
										emptyLabel: t.nav.sidebar.realmsEmpty,
										icon: Globe2,
										isLoading: followedRealms.isPending,
										isError: followedRealms.isError,
										items: realmItems,
									},
								],
								loadingLabel: t.nav.sidebar.loading,
								errorLabel: t.nav.sidebar.error,
							}
						: undefined
				}
				utilities={<ThemeToggle />}
			>
				{children}
			</SharedAppShell>
			{updateInterfaceLocale.error ? (
				<div className="pointer-events-none fixed inset-x-4 top-16 z-[60] flex justify-end">
					<div className="max-w-sm rounded-xl border border-destructive/30 bg-background px-4 py-3 shadow-lg">
						<RequestFailure
							error={updateInterfaceLocale.error}
							fallback={t.ui.retryLater}
						/>
					</div>
				</div>
			) : null}
		</>
	);
}
