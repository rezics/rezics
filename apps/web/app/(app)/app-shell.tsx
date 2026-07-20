"use client";

import { BookOpen, Bookmark, Compass, Plus, TrendingUp, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, useEffect, type ComponentPropsWithoutRef, type ReactNode } from "react";
import {
	getApiUsersMePreferencesQueryKey,
	useGetApiUsersMePreferences,
	useGetApiUsersMeSubscriptions,
	usePutApiUsersMePreferences,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell as SharedAppShell } from "@rezics/ui";
import { isUiLocale, toStoredUiLocale, toUiLocale } from "@rezics/i18n";

import { useAuthPortal } from "@/features/auth/auth-portal";
import { useSetLocale, useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { ThemeToggle } from "./theme-toggle";

const Links = [
	{ href: "/", key: "explore", icon: Compass },
	{ href: "/units/book", key: "units", icon: BookOpen },
	{ href: "/realms", key: "realm", icon: Users },
	{ href: "/me/favorites", key: "favorites", icon: Bookmark },
	{ href: "/me/progress", key: "progress", icon: TrendingUp },
] as const;

const SidebarSubscriptionKinds = ["zone", "realm", "profile"] as const;
type SidebarSubscriptionKind = (typeof SidebarSubscriptionKinds)[number];

function isSidebarSubscriptionKind(value: string): value is SidebarSubscriptionKind {
	return SidebarSubscriptionKinds.some((kind) => kind === value);
}

function subscriptionHref(kind: SidebarSubscriptionKind, id: string) {
	switch (kind) {
		case "zone":
			return `/zones/${id}`;
		case "realm":
			return `/realms/${id}`;
		case "profile":
			return `/users/${id}`;
	}
}

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
		"errorCodes",
		"errors",
		"locale",
		"nav",
		"search",
		"ui",
	]);
	const { setLocale } = useSetLocale();
	const queryClient = useQueryClient();
	const preferences = useGetApiUsersMePreferences({ query: { enabled: Boolean(session) } });
	const subscriptions = useGetApiUsersMeSubscriptions({
		query: { enabled: Boolean(session) },
	});
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
			account={{
				href: session ? "/settings/profile" : "/login",
				label: session ? t.actions.account : t.actions.login,
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
			subscriptions={{
				label: t.nav.subscriptions.title,
				zonesLabel: t.nav.subscriptions.zones,
				realmsLabel: t.nav.subscriptions.realms,
				profilesLabel: t.nav.subscriptions.profiles,
				manageLabel: t.nav.subscriptions.manage,
				manageHref: "/me/subscriptions",
				emptyLabel: t.nav.subscriptions.empty,
				items: (subscriptions.data?.items ?? []).flatMap((item) => {
					if (!isSidebarSubscriptionKind(item.kind)) return [];
					return [
						{
							id: item.id,
							kind: item.kind,
							href: subscriptionHref(item.kind, item.id),
							label: item.title ?? t.ui.unnamed,
							imageUrl: item.avatar?.url ?? item.cover?.url,
							favorite: item.favorite,
						},
					];
				}),
			}}
			utilities={<ThemeToggle />}
		>
			{children}
		</SharedAppShell>
	);
}
