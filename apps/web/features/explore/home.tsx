"use client";

import { ArrowUpDownIcon, ListFilterIcon } from "lucide-react";
import { useQueryState } from "nuqs";

import { ChoiceSelect } from "@rezics/ui";
import { PostList } from "@/features/posts/post-list";
import { useTranslation } from "@/i18n/client";
import {
	feedContentParser,
	FeedContentKinds,
	feedSortParser,
	FeedSorts,
} from "@/lib/search-params";

export function Home() {
	const { t } = useTranslation(["feed", "posts"]);
	const [sort, setSort] = useQueryState("sort", feedSortParser);
	const [contentKinds, setContentKinds] = useQueryState("content", feedContentParser);
	const sortOptions = FeedSorts.map((value) => ({ value, label: t.feed.sort[value] }));
	const contentOptions = [
		{
			value: FeedContentKinds[0],
			label: t.feed.content.post,
			description: t.feed.content.postDescription,
		},
		{
			value: FeedContentKinds[1],
			label: t.feed.content.reply,
			description: t.feed.content.replyDescription,
		},
	] as const;

	return (
		<main className="w-full px-4 py-6 sm:px-7 sm:py-8 lg:px-12">
			<div className="w-full max-w-[58rem]">
				<header className="flex flex-col gap-4 border-b border-border-weak pb-5 sm:flex-row sm:items-end sm:justify-between">
					<h1 className="font-heading font-black text-3xl tracking-tight sm:text-4xl">
						{t.feed.title}
					</h1>
					<div className="flex flex-wrap items-center gap-2">
						<ChoiceSelect
							ariaLabel={t.feed.sortLabel}
							className="min-w-32"
							onValueChange={([nextSort]) => {
								if (nextSort) void setSort(nextSort);
							}}
							options={sortOptions}
							placeholder={t.feed.sortLabel}
							triggerIcon={<ArrowUpDownIcon aria-hidden className="size-4" />}
							value={[sort]}
						/>
						<ChoiceSelect
							ariaLabel={t.feed.contentFilterLabel}
							className="max-w-[min(18rem,calc(100vw-6rem))] min-w-44"
							contentClassName="max-w-[calc(100vw-5rem)]"
							multiple
							onValueChange={(nextKinds) => {
								if (nextKinds.length) void setContentKinds([...nextKinds]);
							}}
							options={contentOptions}
							placeholder={t.feed.contentFilterPlaceholder}
							triggerIcon={<ListFilterIcon aria-hidden className="size-4" />}
							value={contentKinds}
						/>
					</div>
				</header>

				<section aria-label={t.feed.title} className="min-w-0">
					<PostList infinite postKinds={contentKinds} sort={sort} />
				</section>
			</div>
		</main>
	);
}
