"use client";

import { useGetApiProgress, useGetApiRealms } from "@rezics/openapi-tanstack-query";
import {
	ArrowRightIcon,
	BookOpenIcon,
	MessageSquareTextIcon,
	PlusIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useQueryState } from "nuqs";

import {
	Badge,
	Button,
	Card,
	CardContent,
	Progress,
	Skeleton,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@rezics/ui";
import { feedSortParser, FeedSorts, isFeedSort } from "@/lib/search-params";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { useTranslation } from "@/i18n/client";
import { PostList } from "@/features/posts/post-list";
import { UnitShelf } from "./unit-shelf";

export function Home() {
	const { t } = useTranslation({ suspense: true });
	const [sort, setSort] = useQueryState("sort", feedSortParser);

	return (
		<main className="mx-auto flex w-full max-w-[76rem] flex-col gap-5 px-4 py-5 sm:gap-8 sm:px-6 sm:py-9">
			<header className="flex flex-col gap-3 border-b border-border-weak pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-5 sm:pb-7">
				<div className="max-w-2xl">
					<p className="mb-2 hidden font-semibold text-muted-foreground text-xs uppercase tracking-[0.18em] sm:block">
						REZICS
					</p>
					<h1 className="font-serif font-semibold text-3xl tracking-tight sm:text-5xl">
						{t.nav.explore}
					</h1>
					<p className="mt-3 hidden text-base text-muted-foreground sm:block sm:text-lg">
						{t.feed.subtitle}
					</p>
				</div>
				<div className="hidden flex-wrap gap-2 sm:flex">
					<Button asChild className="min-h-11 sm:min-h-9" size="lg">
						<Link href="/create">
							<PlusIcon aria-hidden data-icon="inline-start" />
							{t.actions.create}
						</Link>
					</Button>
					<Button asChild className="min-h-11 sm:min-h-9" size="lg" variant="outline">
						<Link href="/units/book">
							<BookOpenIcon aria-hidden data-icon="inline-start" />
							{t.nav.units}
						</Link>
					</Button>
				</div>
			</header>

			<section aria-labelledby="discover-works" className="grid gap-3 sm:gap-4">
				<div className="flex items-end justify-between gap-4">
					<div>
						<h2
							className="font-serif font-semibold text-xl sm:text-2xl"
							id="discover-works"
						>
							{t.feed.discoverWorks}
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">{t.feed.personalized}</p>
					</div>
					<Button asChild size="sm" variant="ghost">
						<Link href="/units/book">
							{t.feed.viewAll}
							<ArrowRightIcon aria-hidden data-icon="inline-end" />
						</Link>
					</Button>
				</div>
				<UnitShelf personalized type="book" />
			</section>

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
				<div className="min-w-0 overflow-hidden">
					<Tabs
						onValueChange={({ value }) => {
							if (isFeedSort(value)) void setSort(value);
						}}
						value={sort}
					>
						<div className="flex flex-col gap-3 border-b border-border-weak px-4 pt-5 sm:flex-row sm:items-end sm:justify-between sm:px-5">
							<div className="pb-1">
								<div className="flex items-center gap-2">
									<MessageSquareTextIcon
										aria-hidden
										className="size-5 text-brand"
									/>
									<h2 className="font-serif font-semibold text-2xl">
										{t.feed.trending}
									</h2>
								</div>
							</div>
							<TabsList
								aria-label={t.feed.sortLabel}
								className="max-w-full overflow-x-auto"
								variant="underline"
							>
								{FeedSorts.map((value) => (
									<TabsTrigger className="min-w-fit" key={value} value={value}>
										{t.feed.sort[value]}
									</TabsTrigger>
								))}
							</TabsList>
						</div>
						<TabsContent key={sort} value={sort}>
							<section aria-label={t.feed.sort[sort]}>
								<PostList infinite sort={sort} />
							</section>
						</TabsContent>
					</Tabs>
				</div>

				<HomeRail />
			</div>
		</main>
	);
}

function HomeRail() {
	const { t } = useTranslation({ suspense: true });
	const { data: session } = useHydratedSession();

	return (
		<aside className="grid min-w-0 gap-5 lg:sticky lg:top-20" aria-label={t.feed.trending}>
			{session ? <ContinueReading /> : null}
			<ActiveRealms />
			<Card className="min-w-0 border-0 bg-surface-container shadow-none">
				<CardContent className="grid gap-3 px-5">
					<UsersIcon aria-hidden className="size-6 text-brand" />
					<div>
						<h2 className="font-serif font-semibold text-lg">{t.feed.myRealms}</h2>
						<p className="mt-1 text-muted-foreground text-sm leading-6">
							{t.feed.subtitle}
						</p>
					</div>
					<Button asChild className="w-full" variant="outline">
						<Link href="/realms">{t.feed.viewAll}</Link>
					</Button>
				</CardContent>
			</Card>
		</aside>
	);
}

function ContinueReading() {
	const { t } = useTranslation({ suspense: true });
	const query = useGetApiProgress({ query: { limit: 3, status: "active" } });
	const items = query.data?.items ?? [];

	if (query.isError || (!query.isPending && items.length === 0)) return null;
	return (
		<Card className="min-w-0 border-0 bg-surface-container shadow-none">
			<CardContent className="grid gap-4 px-5">
				<div className="flex items-center justify-between gap-3">
					<h2 className="font-serif font-semibold text-lg">{t.feed.continueReading}</h2>
					<BookOpenIcon aria-hidden className="size-4 text-brand" />
				</div>
				{query.isPending
					? Array.from({ length: 2 }, (_, index) => (
							<Skeleton className="h-12" key={index} />
						))
					: items.map((item) => (
							<Link
								className="group grid gap-2"
								href={`/units/${item.type.toLowerCase()}/${item.unitId}`}
								key={item.unitId}
							>
								<div className="flex items-center justify-between gap-3 text-sm">
									<span className="line-clamp-1 font-medium group-hover:underline">
										{item.title ?? item.slug ?? t.ui.unnamed}
									</span>
									<span className="shrink-0 text-muted-foreground text-xs">
										{Math.round(item.progress * 100)}%
									</span>
								</div>
								<Progress value={item.progress * 100} />
							</Link>
						))}
			</CardContent>
		</Card>
	);
}

function ActiveRealms() {
	const { t } = useTranslation({ suspense: true });
	const query = useGetApiRealms({ query: { limit: 5 } });

	return (
		<Card className="min-w-0 border-0 bg-surface-container shadow-none">
			<CardContent className="grid gap-4 px-5">
				<div className="flex items-center justify-between gap-3">
					<h2 className="font-serif font-semibold text-lg">{t.feed.activeRealms}</h2>
					<Badge variant="secondary">Realm</Badge>
				</div>
				{query.isPending
					? Array.from({ length: 3 }, (_, index) => (
							<Skeleton className="h-10" key={index} />
						))
					: query.data?.items.slice(0, 5).map((realm, index) => (
							<Link
								className="group flex min-w-0 items-center gap-3 border-border-weak border-t pt-3 first:border-t-0 first:pt-0"
								href={`/realms/${realm.id}`}
								key={realm.id}
							>
								<span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-selected font-serif font-semibold text-foreground text-sm">
									{index + 1}
								</span>
								<span className="min-w-0">
									<span className="block truncate font-medium text-sm group-hover:underline">
										{realm.title ?? realm.slug ?? t.realms.untitled}
									</span>
									{realm.summary ? (
										<span className="block truncate text-muted-foreground text-xs">
											{realm.summary}
										</span>
									) : null}
								</span>
							</Link>
						))}
				<Button asChild size="sm" variant="ghost">
					<Link href="/realms">
						{t.feed.viewAll}
						<ArrowRightIcon aria-hidden data-icon="inline-end" />
					</Link>
				</Button>
			</CardContent>
		</Card>
	);
}
