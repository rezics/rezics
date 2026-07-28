"use client";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import {
	getApiUsersByIdQueryKey,
	type GetApiUsersByIdStatus200,
	useGetApiUsersById,
	useGetApiUsersMe,
} from "@rezics/openapi-tanstack-query";
import { Banner, Button, cn, IdentityAvatar, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDaysIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useHeaderSearchOverride } from "@/features/application-shell/header-search";
import { FollowButton } from "@/features/following/components/follow-button";
import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { profileHref, type ProfileSection } from "./profile-route";

interface ProfileContextValue {
	profile: GetApiUsersByIdStatus200;
	isCurrentUser: boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfileContext(): ProfileContextValue {
	const context = useContext(ProfileContext);
	if (!context) throw new Error("useProfileContext must be used within ProfileLayout");
	return context;
}

export function ProfileLayout({ children, profileId }: { children: ReactNode; profileId: string }) {
	const { t, locale } = useTranslation(["profiles", "search", "ui"]);
	const pathname = usePathname();
	const queryClient = useQueryClient();
	const { data: session } = useHydratedSession();
	const localizationLanguages = useLocalizationLanguages();
	const profile = useGetApiUsersById({
		path: { id: profileId },
		query: { localizationLanguages },
	});
	const me = useGetApiUsersMe({}, { query: { enabled: Boolean(session) } });
	useLocalizationFallbackToast({
		actualLanguage: profile.data?.language ?? null,
		localizationLanguages,
		unitId: profileId,
	});
	const headerSearch = useMemo(() => {
		if (!profile.data) return undefined;
		const name = profile.data.name ?? t.ui.unnamed;
		return {
			href: `${profileHref(profile.data)}/search`,
			label: t.search.withinLabel({ name }),
			placeholder: t.search.withinPlaceholder({ name }),
			avatar: profile.data.avatar,
			avatarFallback: name.slice(0, 1).toUpperCase(),
		};
	}, [profile.data, t.search, t.ui.unnamed]);
	useHeaderSearchOverride(headerSearch);

	if (profile.isPending || (session && me.isPending)) return <QueryPending />;
	if (profile.isError || !profile.data)
		return <QueryFailure error={profile.error} retry={() => void profile.refetch()} />;

	const user = profile.data;
	const name = user.name ?? t.ui.unnamed;
	const isCurrentUser = me.data?.id === user.id;
	const canFollow = Boolean(session && me.data && !isCurrentUser);
	const contentHref = profileHref(user, "content");
	const activeSection: ProfileSection =
		pathname === contentHref || pathname.startsWith(`${contentHref}/`) ? "content" : "profile";
	const joinedAt = new Date(user.createdAt);
	const joinedDate = Number.isNaN(joinedAt.getTime())
		? null
		: new Intl.DateTimeFormat(locale.target, { dateStyle: "medium" }).format(joinedAt);
	const tabs = [
		{ value: "profile", label: t.profiles.tabs.profile, href: profileHref(user) },
		{ value: "content", label: t.profiles.tabs.content, href: contentHref },
	] as const;

	return (
		<ProfileContext.Provider value={{ profile: user, isCurrentUser }}>
			<main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
				<header>
					<Banner
						alt=""
						className="rounded-2xl bg-surface-selected"
						priority
						src={user.banner?.url}
					/>

					<div className="px-2 sm:px-5">
						<div className="-mt-10 flex items-end justify-between gap-4 sm:-mt-14">
							<IdentityAvatar
								avatar={user.avatar}
								className="size-24 border-4 border-background bg-background text-3xl shadow-sm sm:size-32 sm:text-4xl"
								fallback={name.slice(0, 1).toUpperCase()}
							/>
							<div className="mb-1 flex shrink-0 items-center gap-2">
								{isCurrentUser ? (
									<Button asChild variant="outline">
										<Link href="/settings/profile">
											<PencilIcon aria-hidden data-icon="inline-start" />
											{t.profiles.editProfile}
										</Link>
									</Button>
								) : canFollow ? (
									<FollowButton
										initialFollowing={user.viewerFollowing}
										onChanged={() =>
											queryClient.invalidateQueries({
												queryKey: getApiUsersByIdQueryKey({
													path: { id: user.id },
												}),
											})
										}
										unitId={user.id}
										variant="solid"
									/>
								) : null}
							</div>
						</div>

						<div className="mt-4 min-w-0">
							<h1 className="font-heading font-black text-2xl tracking-tight text-balance sm:text-4xl">
								<LocalizedText language={user.language} value={name} />
							</h1>
							{user.slugAddress ? (
								<p className="mt-1 font-mono text-muted-foreground text-sm">
									{verbatimTerms.profileSlugPrefix.value}
									{user.slugAddress.slug}
								</p>
							) : null}
							{user.summary ? (
								<p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6 sm:text-base">
									<LocalizedText language={user.language} value={user.summary} />
								</p>
							) : null}
							{joinedDate ? (
								<p className="mt-3 flex items-center gap-2 text-muted-foreground text-sm">
									<CalendarDaysIcon aria-hidden className="size-4" />
									{t.profiles.memberSince({ date: joinedDate })}
								</p>
							) : null}
						</div>
					</div>
				</header>

				<div className="mt-7 min-w-0">
					<div className="overflow-x-auto border-b border-border-weak overscroll-x-contain">
						<nav
							aria-label={t.profiles.tabsLabel}
							className="flex min-w-full items-center justify-start gap-x-0.5"
						>
							{tabs.map((tab) => {
								const active = tab.value === activeSection;

								return (
									<Link
										aria-current={active ? "page" : undefined}
										className={cn(
											"relative flex h-10 shrink-0 items-center justify-center rounded-t-lg border border-transparent border-b-2 px-2.5",
											"whitespace-nowrap font-medium text-muted-foreground text-sm",
											"transition-[color,background-color,border-color,box-shadow] hover:bg-accent hover:text-foreground/72",
											"outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/32",
											"motion-reduce:transition-none! sm:h-9",
											active && "border-b-primary text-foreground",
										)}
										href={tab.href}
										key={tab.value}
									>
										{tab.label}
									</Link>
								);
							})}
						</nav>
					</div>
					<div className="pt-6 sm:pt-8">{children}</div>
				</div>
			</main>
		</ProfileContext.Provider>
	);
}
