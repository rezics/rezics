"use client";

import {
	postApiSearchByIndex,
	type PostApiSearchByIndexBody,
	type PostApiSearchByIndexStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, UnitList } from "@rezics/ui";
import { useInfiniteQuery } from "@tanstack/react-query";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useProfileContext } from "./profile-layout";

const ProfileContentCategories = ["posts", "reviews", "collections"] as const;
const ProfileContentPageSize = 10;

type ProfileContentCategory = (typeof ProfileContentCategories)[number];
type ProfileContentHit = PostApiSearchByIndexStatus200["hits"][number];
type ProfileContentPageParam = {
	category: ProfileContentCategory;
	cursor?: string;
}[];

function profileContentRequest(
	category: ProfileContentCategory,
	profileId: string,
	cursor?: string,
): PostApiSearchByIndexBody {
	const common = {
		query: "",
		limit: ProfileContentPageSize,
		sort: "updatedAt:desc" as const,
		...(cursor ? { cursor } : {}),
	};
	return category === "collections"
		? { ...common, ownerId: profileId }
		: { ...common, publisherId: profileId };
}

function profileContentHref(category: ProfileContentCategory, hit: ProfileContentHit): string {
	switch (category) {
		case "posts":
			return `/posts/${hit.id}`;
		case "reviews":
			return `/reviews/${hit.id}`;
		case "collections":
			return `/collections/${hit.id}`;
	}
}

export function ProfileContentPage() {
	const { t } = useTranslation(["actions", "profiles"]);
	const { profile } = useProfileContext();
	const initialPageParam: ProfileContentPageParam = ProfileContentCategories.map((category) => ({
		category,
	}));
	const query = useInfiniteQuery({
		queryKey: ["profile-content", profile.id],
		queryFn: async ({ pageParam, signal }) => {
			const groups = await Promise.all(
				pageParam.map(async ({ category, cursor }) => {
					const { data } = await postApiSearchByIndex({
						body: profileContentRequest(category, profile.id, cursor),
						path: { index: category },
						signal,
						throwOnError: true,
					});
					return { category, ...data };
				}),
			);
			return { groups };
		},
		initialPageParam,
		getNextPageParam: (page): ProfileContentPageParam | undefined => {
			const nextPage = page.groups.flatMap(({ category, nextCursor }) =>
				nextCursor ? [{ category, cursor: nextCursor }] : [],
			);
			return nextPage.length ? nextPage : undefined;
		},
	});
	const sections = ProfileContentCategories.map((category) => ({
		category,
		items:
			query.data?.pages.flatMap((page) =>
				page.groups
					.filter((group) => group.category === category)
					.flatMap((group) =>
						group.hits.map((hit) => ({
							id: hit.id,
							title: hit.titles[0] ?? null,
							summary: hit.summaries[0],
							href: profileContentHref(category, hit),
						})),
					),
			) ?? [],
	})).filter(({ items }) => items.length > 0);

	return (
		<section aria-labelledby="profile-content-title" className="max-w-3xl">
			<div>
				<h2 className="font-heading font-bold text-2xl" id="profile-content-title">
					{t.profiles.contentTitle}
				</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-6">
					{t.profiles.contentDescription}
				</p>
			</div>

			{query.isError && !query.data ? (
				<div className="mt-6">
					<RequestFailure error={query.error} />
				</div>
			) : query.isPending ? (
				<div className="mt-6">
					<UnitList error={false} items={undefined} pending />
				</div>
			) : sections.length ? (
				<div className="mt-7 flex flex-col gap-8">
					{sections.map(({ category, items }) => (
						<section aria-labelledby={`profile-content-${category}`} key={category}>
							<h3
								className="mb-3 font-heading font-semibold text-lg"
								id={`profile-content-${category}`}
							>
								{t.profiles.contentTypes[category]}
							</h3>
							<UnitList error={false} items={items} pending={false} />
						</section>
					))}
				</div>
			) : (
				<p className="mt-6 border-y border-border-weak py-8 text-muted-foreground text-sm">
					{t.profiles.contentEmpty}
				</p>
			)}

			{query.isFetchNextPageError ? (
				<div className="mt-6 flex flex-col items-start gap-3">
					<RequestFailure error={query.error} />
					<Button onClick={() => void query.fetchNextPage()} size="sm" variant="outline">
						{t.actions.retry}
					</Button>
				</div>
			) : query.hasNextPage ? (
				<Button
					className="mt-7"
					isLoading={query.isFetchingNextPage}
					onClick={() => void query.fetchNextPage()}
					variant="outline"
				>
					{t.actions.loadMore}
				</Button>
			) : null}
		</section>
	);
}
