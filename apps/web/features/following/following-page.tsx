"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	getApiUsersMeFollowing,
	getApiUsersMeFollowingQueryKey,
	useDeleteApiUsersMeFollowingByUnitId,
	usePatchApiUsersMeFollowingByUnitId,
	type GetApiUsersMeFollowingQuery,
	type GetApiUsersMeFollowingStatus200ItemsKindEnum as FollowingKind,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	ChoiceSelect,
	type ChoiceOption,
	PageHeading,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Star, UserMinus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { invalidateFollowingQueries } from "./following-cache";
import { FollowingKinds, followingHref } from "./following-route";

const AllFollowingKinds = "all";
type FollowingFilter = FollowingKind | typeof AllFollowingKinds;

export function FollowingPage() {
	return (
		<RequireSession>
			<FollowingContent />
		</RequireSession>
	);
}

function FollowingContent() {
	const { t, locale } = useTranslation(["actions", "nav", "ui"]);
	const queryClient = useQueryClient();
	const [kind, setKind] = useState<FollowingFilter>(AllFollowingKinds);
	const baseQuery = {
		language: toContentLanguage(locale.target),
		limit: 30,
		...(kind === AllFollowingKinds ? {} : { kind }),
	} satisfies GetApiUsersMeFollowingQuery;
	const query = useInfiniteQuery({
		queryKey: getApiUsersMeFollowingQueryKey({ query: baseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiUsersMeFollowing({
				query: { ...baseQuery, ...(pageParam ? { cursor: pageParam } : {}) },
				signal,
				throwOnError: true,
			});
			return data;
		},
		initialPageParam: "",
		getNextPageParam: (page) => page.nextCursor ?? undefined,
	});
	const refreshFollowing = (unitId: string) => invalidateFollowingQueries(queryClient, unitId);
	const update = usePatchApiUsersMeFollowingByUnitId({
		mutation: {
			onSuccess: (_data, variables) => refreshFollowing(variables.path.unitId),
		},
	});
	const unfollow = useDeleteApiUsersMeFollowingByUnitId({
		mutation: {
			onSuccess: (_data, variables) => refreshFollowing(variables.path.unitId),
		},
	});
	const options: readonly ChoiceOption<FollowingFilter>[] = [
		{ value: AllFollowingKinds, label: t.nav.following.all },
		...FollowingKinds.map((value) => ({
			value,
			label: t.nav.following.types[value],
		})),
	];

	if (query.isPending) return <QueryPending />;
	if (query.isError)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const items = query.data.pages.flatMap((page) => page.items);
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 py-8 sm:px-6 sm:py-10">
			<PageHeading description={t.nav.following.description} title={t.nav.following.title} />

			<ChoiceSelect
				ariaLabel={t.nav.following.filter}
				className="w-full sm:w-fit"
				onValueChange={(nextKinds) => setKind(nextKinds[0] ?? AllFollowingKinds)}
				options={options}
				placeholder={t.nav.following.filter}
				value={[kind]}
			/>

			{items.length ? (
				<div className="divide-y divide-border-weak border-y border-border-weak">
					{items.map((item) => {
						const imageUrl = item.avatar?.url ?? item.cover?.url;
						const destination = followingHref(item.kind, item);
						const identity = (
							<>
								<span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-selected font-bold text-sm">
									{imageUrl ? (
										<img
											alt=""
											className="size-full object-cover"
											src={imageUrl}
										/>
									) : (
										(item.title ?? t.ui.unnamed).slice(0, 1).toUpperCase()
									)}
								</span>
								<span className="min-w-0">
									<strong className="block truncate text-sm">
										{item.title ?? t.ui.unnamed}
									</strong>
									<span className="text-muted-foreground text-xs">
										{t.nav.following.types[item.kind]}
									</span>
								</span>
							</>
						);
						return (
							<article className="flex min-w-0 items-center gap-2 py-3" key={item.id}>
								{destination ? (
									<Link
										className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										href={destination}
									>
										{identity}
									</Link>
								) : (
									<div className="flex min-w-0 flex-1 items-center gap-3">
										{identity}
									</div>
								)}
								<Button
									aria-label={
										item.favorite
											? t.nav.following.unfavorite
											: t.nav.following.favorite
									}
									className="shrink-0"
									disabled={update.isPending || unfollow.isPending}
									onClick={() =>
										update.mutate({
											body: { favorite: !item.favorite },
											path: { unitId: item.id },
										})
									}
									size="icon-md"
									title={
										item.favorite
											? t.nav.following.unfavorite
											: t.nav.following.favorite
									}
									variant="ghost"
								>
									<Star
										aria-hidden
										className={item.favorite ? "fill-current" : undefined}
									/>
								</Button>
								<Button
									aria-label={t.ui.unfollow}
									className="shrink-0"
									disabled={update.isPending || unfollow.isPending}
									onClick={() => unfollow.mutate({ path: { unitId: item.id } })}
									size="icon-md"
									title={t.ui.unfollow}
									variant="ghost"
								>
									<UserMinus aria-hidden />
								</Button>
							</article>
						);
					})}
				</div>
			) : (
				<p className="border-y border-border-weak py-8 text-muted-foreground text-sm">
					{t.nav.following.empty}
				</p>
			)}

			{query.hasNextPage ? (
				<Button
					className="self-center"
					isLoading={query.isFetchingNextPage}
					onClick={() => void query.fetchNextPage()}
					variant="outline"
				>
					{t.actions.loadMore}
				</Button>
			) : null}
			<RequestFailure error={update.error ?? unfollow.error} />
		</main>
	);
}
