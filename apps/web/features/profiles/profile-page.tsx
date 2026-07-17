"use client";

import {
	getApiUsersByIdQueryKey,
	useDeleteApiUsersByIdFollow,
	useGetApiUsersById,
	useGetApiUsersMe,
	usePutApiUsersByIdFollow,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";

import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { useTranslation } from "@/i18n/client";

export function ProfilePage({ id }: { id: string }) {
	const { t } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const { data: session } = useHydratedSession();
	const profile = useGetApiUsersById({ path: { id } });
	const me = useGetApiUsersMe({ query: { enabled: Boolean(session) } });
	const follow = usePutApiUsersByIdFollow({
		mutation: {
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: getApiUsersByIdQueryKey({ path: { id } }),
				}),
		},
	});
	const unfollow = useDeleteApiUsersByIdFollow({
		mutation: {
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: getApiUsersByIdQueryKey({ path: { id } }),
				}),
		},
	});
	if (profile.isPending) return <QueryPending />;
	if (profile.isError || !profile.data)
		return <QueryFailure error={profile.error} retry={() => void profile.refetch()} />;
	const user = profile.data;
	const canFollow = Boolean(session && me.data && me.data.id !== user.id);
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={user.name ?? user.slug ?? t.ui.unnamed}
				description={user.summary ?? undefined}
				action={
					canFollow ? (
						<Button
							isLoading={follow.isPending || unfollow.isPending}
							onClick={() =>
								user.viewerFollowing
									? unfollow.mutate({ path: { id: user.id } })
									: follow.mutate({ path: { id: user.id } })
							}
						>
							{user.viewerFollowing ? t.ui.followed : t.ui.follow}
						</Button>
					) : undefined
				}
			/>
			<Card>
				<CardContent className="flex flex-col gap-3 p-5 text-sm">
					<Avatar className="size-20">
						{user.avatar && <AvatarImage alt="" src={user.avatar} />}
						<AvatarFallback>
							{(user.name ?? user.slug ?? t.ui.unnamed).slice(0, 1).toUpperCase()}
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
