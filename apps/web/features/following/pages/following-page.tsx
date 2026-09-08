"use client";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import {
	getApiAccountMeFollowing,
	getApiAccountMeFollowingQueryKey,
	useDeleteApiAccountMeFollowingByUnitId,
	usePatchApiAccountMeFollowingByUnitId,
	type GetApiAccountMeFollowingQuery,
	type GetApiAccountMeFollowingStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	ChoiceSelect,
	IdentityAvatar,
	PageHeading,
	QueryFailure,
	QueryPending,
	type ChoiceOption,
} from "@rezics/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Star, UserMinus } from "lucide-react";
import { useQueryState } from "nuqs";
import type { ComponentProps } from "react";

import { RequireSession } from "@/features/auth/require-session";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { invalidateFollowingQueries } from "../data/following-cache";
import {
	AllFollowingKinds,
	followingFilterParser,
	followingHref,
	FollowingKinds,
	type FollowingFilter,
} from "../routing/following-route";

export function FollowingPage() {
	return (
		<RequireSession>
			<FollowingContent />
		</RequireSession>
	);
}

function FollowingContent() {
	const { t } = useTranslation(["actions", "nav", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const [kind, setKind] = useQueryState("kind", followingFilterParser);
	const baseQuery = {
		localizationLanguages,
		limit: 30,
		...(kind === AllFollowingKinds ? {} : { kind }),
	} satisfies GetApiAccountMeFollowingQuery;
	const query = useInfiniteQuery({
		queryKey: getApiAccountMeFollowingQueryKey({ query: baseQuery }),
		queryFn: async ({ pageParam, signal }) => {
			const { data } = await getApiAccountMeFollowing({
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
	const update = usePatchApiAccountMeFollowingByUnitId({
		mutation: {
			onSuccess: (_data, variables) => refreshFollowing(variables.path.unitId),
		},
	});
	const unfollow = useDeleteApiAccountMeFollowingByUnitId({
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
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const items = query.data.pages.flatMap((page) => page.items);
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 py-8 sm:px-6 sm:py-10">
			<PageHeading description={t.nav.following.description} title={t.nav.following.title} />

			<ChoiceSelect
				ariaLabel={t.nav.following.filter}
				className="w-full sm:w-fit"
				onValueChange={(nextKinds) => void setKind(nextKinds[0] ?? AllFollowingKinds)}
				options={options}
				placeholder={t.nav.following.filter}
				size="lg"
				value={[kind]}
			/>

			{items.length ? (
				<div className="divide-y divide-border-weak border-y border-border-weak">
					{items.map((item) => {
						const avatar =
							item.avatar ?? (item.cover ? { type: "image" as const, image: item.cover } : null);
						const destination = followingHref(item.kind, item);
						return (
							<article className="flex min-w-0 items-center gap-2 py-3" key={item.id}>
								{destination ? (
									<Link
										className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										href={destination}
									>
										<FollowingIdentity avatar={avatar} item={item} />
									</Link>
								) : (
									<div className="flex min-w-0 flex-1 items-center gap-3">
										<FollowingIdentity avatar={avatar} item={item} />
									</div>
								)}
								<Button
									aria-label={item.favorite ? t.nav.following.unfavorite : t.nav.following.favorite}
									className="shrink-0"
									disabled={update.isPending || unfollow.isPending}
									onClick={() =>
										update.mutate({
											body: { favorite: !item.favorite },
											path: { unitId: item.id },
										})
									}
									size="icon-md"
									title={item.favorite ? t.nav.following.unfavorite : t.nav.following.favorite}
									variant="quiet"
								>
									<Star aria-hidden className={item.favorite ? "fill-current" : undefined} />
								</Button>
								<Button
									aria-label={t.ui.unfollow}
									className="shrink-0"
									disabled={update.isPending || unfollow.isPending}
									onClick={() => unfollow.mutate({ path: { unitId: item.id } })}
									size="icon-md"
									title={t.ui.unfollow}
									variant="quiet"
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

function FollowingIdentity({
	avatar,
	item,
}: {
	readonly avatar: ComponentProps<typeof IdentityAvatar>["avatar"];
	readonly item: GetApiAccountMeFollowingStatus200["items"][number];
}) {
	const { t } = useTranslation(["nav", "ui"]);
	const title = useChineseContentText(
		item.title ?? t.ui.unnamed,
		item.title ? item.language : null,
	);
	return (
		<>
			<IdentityAvatar
				avatar={avatar}
				className="size-11"
				fallback={title.slice(0, 1).toUpperCase()}
			/>
			<span className="min-w-0">
				<strong className="block truncate text-sm">{title}</strong>
				<span className="text-muted-foreground text-xs">{t.nav.following.types[item.kind]}</span>
			</span>
		</>
	);
}
