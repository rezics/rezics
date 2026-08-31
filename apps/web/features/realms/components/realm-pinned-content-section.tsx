"use client";

import type { PresentedAvatar } from "@rezics/avatar";
import type { ReactNode } from "react";
import { ChevronDownIcon, PinIcon } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useId, useState } from "react";

import {
	Button,
	Card,
	CardContent,
	CardMedia,
	cn,
	IdentityAvatar,
	Shelf,
	Skeleton,
} from "@rezics/ui";
import type { ContentLanguage } from "@rezics/i18n";
import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import { useTranslation } from "@/i18n/client";

export interface RealmPinnedContentItem {
	readonly id: string;
	readonly href?: string;
	readonly avatar?: PresentedAvatar | null;
	readonly identity?: boolean;
	readonly imageUrl?: string | null;
	readonly language?: ContentLanguage | null;
	readonly summary?: string | null;
	readonly summaryLanguage?: ContentLanguage | null;
	readonly title?: string | null;
}

export type RealmPinnedContentState =
	| { readonly status: "loading" }
	| { readonly status: "error"; readonly feedback: ReactNode }
	| { readonly status: "ready"; readonly items: readonly RealmPinnedContentItem[] };

export interface RealmPinnedContentSectionProps {
	readonly emptyLabel: string;
	readonly nextLabel: string;
	readonly previousLabel: string;
	readonly state: RealmPinnedContentState;
	readonly title: string;
	readonly untitledLabel: string;
}

export function RealmPinnedContentSection({
	emptyLabel,
	nextLabel,
	previousLabel,
	state,
	title,
	untitledLabel,
}: RealmPinnedContentSectionProps) {
	const [open, setOpen] = useState(true);
	const contentId = useId();

	return (
		<section aria-label={title} className="min-w-0">
			<Button
				aria-controls={contentId}
				aria-expanded={open}
				className="h-auto w-full justify-between px-3 py-2 text-left font-semibold"
				onClick={() => setOpen((current) => !current)}
				type="button"
				variant="quiet"
			>
				<span className="flex min-w-0 items-center gap-2">
					<PinIcon aria-hidden data-icon="inline-start" />
					<span>{title}</span>
				</span>
				<ChevronDownIcon
					aria-hidden
					className={cn(
						"text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
						open && "rotate-180",
					)}
					data-icon="inline-end"
				/>
			</Button>
			{open ? (
				<div className="min-w-0 pt-3" id={contentId}>
					{state.status === "loading" ? (
						<div className="grid auto-cols-[minmax(13rem,72%)] grid-flow-col gap-3 overflow-x-auto pb-1 sm:auto-cols-[minmax(13rem,42%)] xl:auto-cols-[minmax(13rem,32%)]">
							{Array.from({ length: 3 }, (_, index) => (
								<Skeleton className="h-44 rounded-xl" key={index} />
							))}
						</div>
					) : state.status === "error" ? (
						state.feedback
					) : state.items.length === 0 ? (
						<p className="px-3 text-muted-foreground text-sm">{emptyLabel}</p>
					) : (
						<RealmPinnedCarousel
							items={state.items}
							nextLabel={nextLabel}
							previousLabel={previousLabel}
							title={title}
							untitledLabel={untitledLabel}
						/>
					)}
				</div>
			) : null}
		</section>
	);
}

function RealmPinnedCarousel({
	items,
	nextLabel,
	previousLabel,
	title,
	untitledLabel,
}: {
	readonly items: readonly RealmPinnedContentItem[];
	readonly nextLabel: string;
	readonly previousLabel: string;
	readonly title: string;
	readonly untitledLabel: string;
}) {
	const { t } = useTranslation(["ui"]);

	return (
		<Shelf
			itemClassName="[&_img]:rounded-none"
			labels={{
				label: title,
				next: nextLabel,
				previous: previousLabel,
				page: ({ page, pageCount }) => t.ui.shelf.page({ page, pageCount }),
				item: ({ item, itemCount }) => t.ui.shelf.item({ item, itemCount }),
			}}
		>
			{items.map((item) => (
				<RealmPinnedItemCard item={item} key={item.id} untitledLabel={untitledLabel} />
			))}
		</Shelf>
	);
}

function RealmPinnedItemCard({
	item,
	untitledLabel,
}: {
	readonly item: RealmPinnedContentItem;
	readonly untitledLabel: string;
}) {
	const title = item.title?.trim() || untitledLabel;
	const content = (
		<Card appearance="outlined" className="h-44 min-w-0 gap-0 overflow-hidden py-0 shadow-none">
			{item.identity ? (
				<CardContent className="min-h-0 p-4">
					<div className="flex items-center gap-3">
						<IdentityAvatar
							avatar={item.avatar}
							className="size-12"
							fallback={Array.from(title)[0]?.toLocaleUpperCase() ?? title}
						/>
						<h3 className="line-clamp-2 min-w-0 font-semibold leading-5">
							<LocalizedText language={item.language} value={title} />
						</h3>
					</div>
					{item.summary ? (
						<p className="mt-3 line-clamp-3 text-muted-foreground text-sm leading-5">
							<LocalizedText
								language={item.summaryLanguage ?? item.language}
								value={item.summary}
							/>
						</p>
					) : null}
				</CardContent>
			) : item.imageUrl ? (
				<>
					<CardMedia className="h-28 px-0" variant="image">
						<img alt="" loading="lazy" src={item.imageUrl} />
					</CardMedia>
					<CardContent className="min-h-0 px-4 py-3">
						<h3 className="line-clamp-2 font-semibold text-sm leading-5">
							<LocalizedText language={item.language} value={title} />
						</h3>
					</CardContent>
				</>
			) : (
				<CardContent className="min-h-0 p-4">
					<h3 className="line-clamp-2 font-semibold leading-5">
						<LocalizedText language={item.language} value={title} />
					</h3>
					{item.summary ? (
						<p className="mt-2 line-clamp-4 text-muted-foreground text-sm leading-5">
							<LocalizedText
								language={item.summaryLanguage ?? item.language}
								value={item.summary}
							/>
						</p>
					) : null}
				</CardContent>
			)}
		</Card>
	);

	return item.href ? (
		<Link className="block min-w-0 text-inherit no-underline" href={item.href}>
			{content}
		</Link>
	) : (
		content
	);
}
