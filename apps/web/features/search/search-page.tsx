"use client";

import { postApiSearch, type PostApiSearchStatus200 } from "@rezics/openapi-tanstack-query";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PageHeading } from "@rezics/ui";
import { UnitList } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

type SearchHit = PostApiSearchStatus200["groups"][number]["hits"][number];

function searchHitHref(index: string, hit: SearchHit) {
	switch (index) {
		case "users":
			return `/users/${hit.id}`;
		case "realms":
			return `/realms/${hit.id}`;
		case "posts":
			return `/posts/${hit.id}`;
		case "collections":
			return `/collections/${hit.id}`;
		case "reviews":
			return `/reviews/${hit.id}`;
		case "entity":
			return `/entities/${hit.id}`;
		case "polls":
			return `/polls/${hit.id}`;
		case "units":
			return hit.type === "book" || hit.type === "game" || hit.type === "media"
				? `/units/${hit.type}/${hit.id}`
				: undefined;
		default:
			return undefined;
	}
}

export function SearchPage() {
	const { t } = useTranslation({ suspense: true });
	const params = useSearchParams();
	const router = useRouter();
	const routeQuery = params.get("q")?.trim() ?? "";
	const [input, setInput] = useState(routeQuery);
	useEffect(() => setInput(routeQuery), [routeQuery]);
	const search = useQuery({
		queryKey: ["search", routeQuery],
		queryFn: async ({ signal }) => {
			const { data } = await postApiSearch({
				body: { query: routeQuery, limitPerIndex: 8 },
				signal,
			});
			return data;
		},
		enabled: Boolean(routeQuery),
	});
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={t.search.title} />
			<form
				className="flex gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					const nextQuery = input.trim();
					const next = new URLSearchParams(params.toString());
					if (nextQuery) next.set("q", nextQuery);
					else next.delete("q");
					router.replace(next.size ? `/search?${next}` : "/search");
				}}
			>
				<InputGroup className="min-w-0 flex-1">
					<InputGroupAddon align="inline-start">
						<Search aria-hidden className="size-4" />
					</InputGroupAddon>
					<InputGroupInput
						aria-label={t.search.placeholder}
						value={input}
						onChange={(event) => setInput(event.currentTarget.value)}
						placeholder={t.search.placeholder}
						type="search"
					/>
				</InputGroup>
				<Button type="submit" isLoading={search.isFetching}>
					{t.actions.search}
				</Button>
			</form>
			{search.isError ? (
				<RequestFailure error={search.error} />
			) : routeQuery && search.data ? (
				<UnitList
					items={search.data.groups.flatMap((group) =>
						group.hits.map((hit) => ({
							id: hit.id,
							slug: hit.slug,
							title: hit.titles[0] ?? hit.name ?? null,
							summary: hit.summaries[0] ?? hit.summary,
							href: searchHitHref(group.index, hit),
						})),
					)}
					pending={search.isPending}
					error={false}
				/>
			) : (
				!search.isFetching && (
					<p className="text-muted-foreground text-sm">{t.search.empty}</p>
				)
			)}
		</main>
	);
}
