"use client";

import {
	getApiUsersByIdQueryKey,
	type GetApiUsersByIdStatus200,
	useGetApiUsersById,
	useGetApiUsersMe,
} from "@rezics/openapi-tanstack-query";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Button,
	QueryFailure,
	QueryPending,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDaysIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { FollowButton } from "@/features/following/follow-button";
import { useTranslation } from "@/i18n/client";
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

export function ProfileLayout({ children, id }: { children: ReactNode; id: string }) {
	const { t, locale } = useTranslation(["profiles", "ui"]);
	const pathname = usePathname();
	const queryClient = useQueryClient();
	const { data: session } = useHydratedSession();
	const profile = useGetApiUsersById({ path: { id } });
	const me = useGetApiUsersMe({ query: { enabled: Boolean(session) } });

	if (profile.isPending || (session && me.isPending)) return <QueryPending />;
	if (profile.isError || !profile.data)
		return <QueryFailure error={profile.error} retry={() => void profile.refetch()} />;

	const user = profile.data;
	const name = user.name ?? t.ui.unnamed;
	const isCurrentUser = me.data?.id === user.id;
	const canFollow = Boolean(session && me.data && !isCurrentUser);
	const contentHref = profileHref(user.id, "content");
	const activeSection: ProfileSection =
		pathname === contentHref || pathname.startsWith(`${contentHref}/`) ? "content" : "profile";
	const joinedAt = new Date(user.createdAt);
	const joinedDate = Number.isNaN(joinedAt.getTime())
		? null
		: new Intl.DateTimeFormat(locale.target, { dateStyle: "medium" }).format(joinedAt);
	const tabs = [
		{ value: "profile", label: t.profiles.tabs.profile, href: profileHref(user.id) },
		{ value: "content", label: t.profiles.tabs.content, href: contentHref },
	] as const;

	return (
		<ProfileContext.Provider value={{ profile: user, isCurrentUser }}>
			<main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
				<header>
					<div className="aspect-[3/1] min-h-28 overflow-hidden rounded-2xl bg-surface-selected sm:min-h-40">
						{user.banner ? (
							<img alt="" className="size-full object-cover" src={user.banner.url} />
						) : null}
					</div>

					<div className="px-2 sm:px-5">
						<div className="-mt-10 flex items-end justify-between gap-4 sm:-mt-14">
							<Avatar className="size-24 border-4 border-background bg-background text-3xl shadow-sm sm:size-32 sm:text-4xl">
								{user.avatar ? <AvatarImage alt="" src={user.avatar.url} /> : null}
								<AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
							</Avatar>
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
										variant="default"
									/>
								) : null}
							</div>
						</div>

						<div className="mt-4 min-w-0">
							<h1 className="font-heading font-black text-2xl tracking-tight text-balance sm:text-4xl">
								{name}
							</h1>
							{user.summary ? (
								<p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6 sm:text-base">
									{user.summary}
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

				<Tabs
					activationMode="manual"
					className="mt-7 min-w-0 gap-0"
					translations={{ listLabel: t.profiles.tabsLabel }}
					value={activeSection}
				>
					<div className="overflow-x-auto border-b border-border-weak overscroll-x-contain">
						<TabsList className="min-w-full justify-start" variant="underline">
							{tabs.map((tab) => (
								<TabsTrigger asChild key={tab.value} value={tab.value}>
									<Link href={tab.href}>{tab.label}</Link>
								</TabsTrigger>
							))}
						</TabsList>
					</div>
					<TabsContent className="pt-6 sm:pt-8" value={activeSection}>
						{children}
					</TabsContent>
				</Tabs>
			</main>
		</ProfileContext.Provider>
	);
}
