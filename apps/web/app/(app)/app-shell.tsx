"use client";

import { BookOpen, Bookmark, Home, Plus, Search, TrendingUp, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
	getApiUsersMePreferencesQueryKey,
	useGetApiFeed,
	useGetApiProgress,
	useGetApiRealms,
	useGetApiUsersMePreferences,
	usePutApiUsersMePreferences,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import {
	AppShell as SharedAppShell,
	Avatar,
	AvatarFallback,
	Card,
	CardAction,
	CardContent,
	CardHeader,
	Logo,
	Progress,
	ProgressValue,
	SidebarTrigger,
} from "@rezics/ui";

import { authClient } from "@/lib/auth-client";
import { useSetLocale, useTranslation } from "@/i18n/client";
import { ThemeToggle } from "./theme-toggle";

const Links = [
	{ href: "/", key: "explore", icon: Home },
	{ href: "/units/book", key: "units", icon: BookOpen },
	{ href: "/realms", key: "realm", icon: Users },
	{ href: "/me/favorites", key: "favorites", icon: Bookmark },
	{ href: "/me/progress", key: "progress", icon: TrendingUp },
] as const;

export function ApplicationShell({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const { data: session } = authClient.useSession();
	const { t, locale } = useTranslation({ suspense: true });
	const setLocale = useSetLocale();
	const queryClient = useQueryClient();
	const preferences = useGetApiUsersMePreferences({ query: { enabled: Boolean(session) } });
	const updatePreferences = usePutApiUsersMePreferences({
		mutation: {
			onSuccess: () =>
				queryClient.invalidateQueries({ queryKey: getApiUsersMePreferencesQueryKey() }),
		},
	});

	useEffect(() => {
		const preferred = preferences.data?.preferredLanguages[0];
		if (preferred && preferred !== locale.target) setLocale(preferred);
	}, [locale.target, preferences.data?.preferredLanguages, setLocale]);

	return (
		<SharedAppShell
			account={{
				href: session ? "/settings/profile" : "/login",
				label: session ? t.actions.account : t.actions.login,
				mobileLabel: t.nav.me,
				icon: UserRound,
			}}
			brand={<Logo alt={t.brand} className="size-10" />}
			create={{
				href: session ? "/create" : "/login?next=/create",
				icon: Plus,
				label: t.actions.create,
			}}
			currentPath={pathname}
			link={Link}
			mobileNavigation={Links.filter(
				({ key }) => key === "explore" || key === "units" || key === "realm",
			).map(({ href, key, icon }) => ({ href, label: t.nav[key], icon }))}
			locale={{
				label: t.locale.label,
				onChange: async (nextLocale) => {
					if (preferences.data)
						await updatePreferences.mutateAsync({
							body: {
								defaultLicense: preferences.data.defaultLicense,
								defaultRealmManageMode: preferences.data.defaultRealmManageMode,
								collectionConfig: preferences.data.collectionConfig,
								personalizedFeed: preferences.data.personalizedFeed,
								contentRatings: preferences.data.contentRatings.map((value) =>
									value === "r15" || value === "r18" || value === "r18g"
										? value
										: "general",
								),
								preferredLanguages: [
									nextLocale,
									...preferences.data.preferredLanguages.filter(
										(language) => language !== nextLocale,
									),
								],
							},
						});
					setLocale(nextLocale);
				},
				options: [
					{ value: "zh-CN", label: t.locale.zh },
					{ value: "en-US", label: t.locale.en },
				],
				value: locale.target,
			}}
			navigation={Links.map(({ href, key, icon }) => ({
				href,
				label: t.nav[key],
				icon,
			}))}
			search={{ href: "/search", icon: Search, label: t.actions.search }}
			secondaryNavigation={<MyRealmRail />}
			utilities={
				<>
					<span className="hidden md:inline-flex">
						<ThemeToggle />
					</span>
					<SidebarTrigger aria-label="Menu" className="md:hidden" />
				</>
			}
			rightRail={<DiscoveryRail />}
		>
			{children}
		</SharedAppShell>
	);
}

function MyRealmRail() {
	const { t } = useTranslation({ suspense: true });
	const realms = useGetApiRealms({ query: { limit: 5 } });
	return (
		<div>
			<p className="text-muted-foreground px-2 text-xs font-semibold">{t.feed.myRealms}</p>
			<div className="mt-3 grid gap-1">
				{realms.data?.items.map((realm) => (
					<Link
						key={realm.id}
						href={`/realms/${realm.id}`}
						className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-sidebar-accent"
					>
						<Avatar className="size-8 rounded-md">
							<AvatarFallback className="bg-accent text-accent-foreground rounded-md font-black">
								{(realm.title ?? realm.slug ?? "R").slice(0, 1)}
							</AvatarFallback>
						</Avatar>
						<span className="min-w-0">
							<span className="block truncate font-medium">
								{realm.title ?? realm.slug ?? t.realms.untitled}
							</span>
							<span className="text-muted-foreground block text-[10px]">Realm</span>
						</span>
					</Link>
				))}
			</div>
		</div>
	);
}

function DiscoveryRail() {
	const { t } = useTranslation({ suspense: true });
	const { data: session } = authClient.useSession();
	const trending = useGetApiFeed({ query: { sort: "hot", personalized: false, limit: 5 } });
	const realms = useGetApiRealms({ query: { limit: 5 } });
	const progress = useGetApiProgress(
		{ query: { limit: 3 } },
		{ query: { enabled: Boolean(session) } },
	);
	return (
		<div className="grid gap-3">
			<RailCard action={t.feed.viewAll} href="/posts" title={t.feed.trending}>
				<div className="grid gap-3">
					{trending.data?.items.length ? (
						trending.data.items.map((post, index) => (
							<Link
								key={post.id}
								className="group grid grid-cols-[1.25rem_1fr] gap-2 text-sm"
								href={`/posts/${post.id}`}
							>
								<span className="text-primary font-bold">{index + 1}</span>
								<span>
									<span className="line-clamp-2 font-medium leading-5 group-hover:text-primary">
										{post.title ?? t.posts.untitled}
									</span>
									<span className="text-muted-foreground mt-0.5 block text-xs">
										{post.replyCount} {t.posts.replies}
									</span>
								</span>
							</Link>
						))
					) : (
						<p className="text-muted-foreground text-xs">{t.state.empty}</p>
					)}
				</div>
			</RailCard>
			<RailCard action={t.feed.viewAll} href="/realms" title={t.feed.activeRealms}>
				<div className="grid gap-3">
					{realms.data?.items.length ? (
						realms.data.items.map((realm) => (
							<Link
								key={realm.id}
								className="flex items-center gap-2.5 text-sm"
								href={`/realms/${realm.id}`}
							>
								<Avatar className="size-8 rounded-md">
									<AvatarFallback className="bg-accent text-accent-foreground rounded-md font-black">
										{(realm.title ?? realm.slug ?? "R").slice(0, 1)}
									</AvatarFallback>
								</Avatar>
								<span className="min-w-0">
									<span className="block truncate font-medium">
										{realm.title ?? realm.slug ?? t.realms.untitled}
									</span>
									<span className="text-muted-foreground block truncate text-xs">
										{realm.summary ?? t.realms.open}
									</span>
								</span>
							</Link>
						))
					) : (
						<p className="text-muted-foreground text-xs">{t.state.empty}</p>
					)}
				</div>
			</RailCard>
			{session && (
				<RailCard
					action={t.feed.viewAll}
					href="/me/progress"
					title={t.feed.continueReading}
				>
					<div className="grid gap-3">
						{progress.data?.items.map((item) => (
							<Link
								key={item.unitId}
								href={`/units/${item.type.toLowerCase()}/${item.unitId}`}
								className="grid gap-1 text-sm"
							>
								<span className="truncate font-medium">
									{item.title ?? t.ui.unnamed}
								</span>
								<Progress
									className="gap-1"
									value={Math.min(item.progress * 100, 100)}
								>
									<ProgressValue className="text-xs" />
								</Progress>
							</Link>
						))}
					</div>
				</RailCard>
			)}
			<p className="text-muted-foreground px-1 text-xs">
				© 2026 REZICS · inherited · create · spread
			</p>
		</div>
	);
}

function RailCard({
	action,
	children,
	href,
	title,
}: {
	action: string;
	children: ReactNode;
	href: string;
	title: string;
}) {
	return (
		<Card className="[--space:--spacing(4)]">
			<CardHeader title={title}>
				<CardAction>
					<Link className="text-muted-foreground text-xs hover:text-primary" href={href}>
						{action}
					</Link>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-3">{children}</CardContent>
		</Card>
	);
}
