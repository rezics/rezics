"use client";

import { Flame, ListFilter, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
	getApiUsersMePreferencesQueryKey,
	useGetApiUsersMePreferences,
	usePutApiUsersMePreferences,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";

import { Field, FieldLabel, Switch, ToggleGroup, ToggleGroupItem } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { PostList } from "@/features/posts/post-list";
import { invalidateRecommendationQueries } from "@/features/recommendations/query";
import { authClient } from "@/lib/auth-client";
import { UnitShelf } from "./unit-shelf";

const Sorts = ["best", "hot", "new", "top", "rising"] as const;

export function Home() {
	const { t } = useTranslation({ suspense: true });
	const [sort, setSort] = useState<(typeof Sorts)[number]>("best");
	const [personalizedOverride, setPersonalizedOverride] = useState<{
		owner: string | null;
		source: boolean;
		value: boolean;
	}>();
	const { data: session } = authClient.useSession();
	const queryClient = useQueryClient();
	const preferences = useGetApiUsersMePreferences({ query: { enabled: Boolean(session) } });
	const updatePreferences = usePutApiUsersMePreferences({
		mutation: {
			onError: () => setPersonalizedOverride(undefined),
			onSuccess: () =>
				Promise.all([
					queryClient.invalidateQueries({ queryKey: getApiUsersMePreferencesQueryKey() }),
					invalidateRecommendationQueries(queryClient),
				]),
		},
	});

	const owner = session?.user.id ?? null;
	const storedPersonalized = session ? (preferences.data?.personalizedFeed ?? false) : false;
	const activeOverride =
		personalizedOverride?.owner === owner && personalizedOverride.source === storedPersonalized
			? personalizedOverride
			: undefined;
	const personalized = activeOverride?.value ?? storedPersonalized;

	function updatePersonalized(value: boolean) {
		if (!session) return;
		setPersonalizedOverride({ owner, source: storedPersonalized, value });
		if (preferences.data) {
			const current = preferences.data;
			updatePreferences.mutate({
				body: {
					defaultLicense: current.defaultLicense,
					defaultRealmManageMode: current.defaultRealmManageMode,
					collectionConfig: current.collectionConfig,
					contentRatings: current.contentRatings.map((value) =>
						value === "r15" || value === "r18" || value === "r18g" ? value : "general",
					),
					preferredLanguages: current.preferredLanguages,
					personalizedFeed: value,
				},
			});
		}
	}

	return (
		<main className="min-h-svh">
			<header className="bg-background/92 sticky top-14 z-20 border-b px-4 py-3 backdrop-blur-xl md:top-0">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h1 className="font-heading text-xl font-black tracking-tight">
							{t.feed.title}
						</h1>
						<p className="text-muted-foreground text-xs">{t.feed.subtitle}</p>
					</div>
					<Field className="w-auto" orientation="horizontal">
						<Sparkles aria-hidden className="size-3.5" />
						<FieldLabel className="hidden text-xs font-normal sm:inline">
							{t.feed.personalized}
						</FieldLabel>
						<Switch
							checked={personalized}
							disabled={!session || !preferences.data || updatePreferences.isPending}
							onCheckedChange={({ checked }) => updatePersonalized(checked)}
						/>
					</Field>
				</div>
			</header>

			<div className="border-b px-4 py-2">
				<ToggleGroup
					className="overflow-x-auto"
					aria-label={t.feed.sortLabel}
					multiple={false}
					onValueChange={({ value }) => {
						const next = value[0];
						const selected = Sorts.find((sort) => sort === next);
						if (selected) setSort(selected);
					}}
					spacing={1}
					value={[sort]}
				>
					{Sorts.map((value) => (
						<ToggleGroupItem
							aria-label={t.feed.sort[value]}
							key={value}
							className="shrink-0 rounded-none border-b-2 border-transparent px-4 data-[state=on]:border-primary data-[state=on]:text-primary"
							value={value}
						>
							{value === "hot" ? (
								<Flame aria-hidden className="size-3.5" />
							) : value === "best" ? (
								<ListFilter aria-hidden className="size-3.5" />
							) : null}
							{t.feed.sort[value]}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			</div>

			<section aria-label={t.feed.title}>
				<PostList sort={sort} personalized={activeOverride?.value} />
			</section>

			<section className="border-t px-4 py-8">
				<div className="mb-5 flex items-center justify-between">
					<div>
						<p className="text-primary text-xs font-bold uppercase tracking-wider">
							{t.home.latest}
						</p>
						<h2 className="font-heading mt-1 text-xl font-black">
							{t.feed.discoverWorks}
						</h2>
					</div>
					<Link className="text-primary text-sm font-semibold" href="/units/book">
						{t.actions.view}
					</Link>
				</div>
				<div className="grid gap-8">
					{(["book", "game", "media"] as const).map((type) => (
						<UnitShelf key={type} type={type} personalized={activeOverride?.value} />
					))}
				</div>
			</section>
		</main>
	);
}
