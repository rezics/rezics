"use client";

import { useGetApiUsersById, useGetApiUsersMe } from "@rezics/openapi-tanstack-query";

import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui";
import { FollowButton } from "@/features/following/follow-button";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { useTranslation } from "@/i18n/client";

export function ProfilePage({ id }: { id: string }) {
	const { t } = useTranslation(["profiles", "ui"]);
	const { data: session } = useHydratedSession();
	const profile = useGetApiUsersById({ path: { id } });
	const me = useGetApiUsersMe({ query: { enabled: Boolean(session) } });
	if (profile.isPending) return <QueryPending />;
	if (profile.isError || !profile.data)
		return <QueryFailure error={profile.error} retry={() => void profile.refetch()} />;
	const user = profile.data;
	const canFollow = Boolean(session && me.data && me.data.id !== user.id);
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			{user.banner ? (
				<div className="aspect-[3/1] overflow-hidden rounded-2xl bg-muted">
					<img alt="" className="size-full object-cover" src={user.banner.url} />
				</div>
			) : null}
			<PageHeading
				title={user.name ?? t.ui.unnamed}
				description={user.summary ?? undefined}
				action={
					canFollow ? (
						<FollowButton
							initialFollowing={user.viewerFollowing}
							onChanged={() => profile.refetch()}
							unitId={user.id}
						/>
					) : undefined
				}
			/>
			<Card>
				<CardContent className="flex flex-col gap-3 p-5 text-sm">
					<Avatar className="size-20">
						{user.avatar ? <AvatarImage alt="" src={user.avatar.url} /> : null}
						<AvatarFallback>
							{(user.name ?? t.ui.unnamed).slice(0, 1).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<p className="text-muted-foreground">
						{t.profiles.memberSince} {new Date(user.createdAt).toLocaleDateString()}
					</p>
				</CardContent>
			</Card>
		</main>
	);
}
