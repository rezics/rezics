"use client";

import { realmTagQueryPredicate } from "@rezics/filter";
import {
	useGetApiRealmsByRealmIdTaxonomy,
	type GetApiRealmsByRealmIdStatus200,
	type GetApiRealmsByRealmIdTaxonomyStatus200,
} from "@rezics/openapi-tanstack-query";
import {
	Badge,
	Button,
	Card,
	CardContent,
	IdentityAvatar,
	QueryFailure,
	QueryPending,
} from "@rezics/ui";
import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { postHref } from "@/features/posts/url";
import { tagDetailHref } from "@/features/tags/routing/tag-links";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RealmFeed } from "./realm-feed";

type TaxonomyItem = GetApiRealmsByRealmIdTaxonomyStatus200["items"][number];

function taxonomyDepth(items: readonly TaxonomyItem[], item: TaxonomyItem): number {
	const parentById = new Map(items.map((candidate) => [candidate.id, candidate.parentId]));
	let depth = 0;
	let parentId = item.parentId;
	const visited = new Set([item.id]);
	while (parentId && !visited.has(parentId)) {
		visited.add(parentId);
		depth += 1;
		parentId = parentById.get(parentId) ?? null;
	}
	return depth;
}

export function RealmTaxonomyPage({ realm }: { readonly realm: GetApiRealmsByRealmIdStatus200 }) {
	const { t } = useTranslation(["actions", "realms", "state", "tags", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const taxonomy = useGetApiRealmsByRealmIdTaxonomy({
		path: { realmId: realm.id },
		query: { localizationLanguages },
	});
	const [selectedTagId, setSelectedTagId] = useState<string>();
	if (taxonomy.isPending) return <QueryPending />;
	if (taxonomy.isError)
		return <QueryFailure error={taxonomy.error} retry={() => void taxonomy.refetch()} />;
	const items = taxonomy.data?.items ?? [];
	const selectedTag = items.find(
		(item) => item.contentKind === "tag" && item.contentUnitId === selectedTagId,
	);
	const selectedStrategy = selectedTag?.queryStrategy;
	return (
		<div className="grid min-w-0 gap-6">
			<section className="grid gap-3" aria-labelledby="realm-taxonomy-heading">
				<div className="grid gap-1">
					<h2 className="font-heading font-bold text-xl" id="realm-taxonomy-heading">
						{t.realms.taxonomy.title}
					</h2>
					<p className="text-muted-foreground text-sm">{t.realms.taxonomy.description}</p>
				</div>
				{items.length ? (
					<div className="grid gap-2">
						{items.map((item) => (
							<TaxonomyItemCard
								depth={taxonomyDepth(items, item)}
								item={item}
								key={item.id}
								onSelectTag={setSelectedTagId}
								realmId={realm.id}
								selected={selectedTagId === item.contentUnitId}
							/>
						))}
					</div>
				) : (
					<Card appearance="outlined">
						<CardContent className="p-6 text-center text-muted-foreground text-sm">
							{t.realms.taxonomy.empty}
						</CardContent>
					</Card>
				)}
			</section>
			{selectedTag && selectedStrategy ? (
				<section className="grid gap-3" aria-labelledby="realm-tag-feed-heading">
					<div className="grid gap-1">
						<h2 className="font-heading font-bold text-xl" id="realm-tag-feed-heading">
							{selectedTag.title ?? t.tags.unnamedTag}
						</h2>
						<p className="text-muted-foreground text-sm">
							{t.realms.taxonomy.filteredBy({
								strategy: t.realms.taxonomy.strategies[selectedStrategy].label,
							})}
						</p>
					</div>
					<RealmFeed
						additionalFilter={realmTagQueryPredicate({
							realmId: realm.id,
							tagId: selectedTag.contentUnitId,
							strategy: selectedStrategy,
						})}
						canManagePins={realm.capabilities.canManagePins}
						canManageTags={realm.capabilities.canManageTags}
						canModerateUnits={realm.capabilities.canModerateUnits}
						realmId={realm.id}
					/>
				</section>
			) : null}
		</div>
	);
}

function TaxonomyItemCard({
	depth,
	item,
	onSelectTag,
	realmId,
	selected,
}: {
	readonly depth: number;
	readonly item: TaxonomyItem;
	readonly onSelectTag: (tagId: string) => void;
	readonly realmId: string;
	readonly selected: boolean;
}) {
	const { t } = useTranslation(["actions", "realms", "tags", "ui"]);
	const title = item.title ?? (item.contentKind === "tag" ? t.tags.unnamedTag : t.ui.unnamed);
	const detailHref =
		item.contentKind === "tag"
			? item.contextPostId
				? postHref(item.contextPostId, { kind: "realm", realmId })
				: tagDetailHref(item.contentUnitId)
			: item.contentKind === "wiki"
				? postHref(item.contentUnitId)
				: undefined;
	return (
		<Card
			appearance="outlined"
			className={selected ? "border-brand bg-brand/5" : undefined}
			style={{ marginInlineStart: `${Math.min(depth, 4) * 1.25}rem` }}
		>
			<CardContent className="flex items-center gap-3 p-4">
				{item.contentKind === "tag" ? (
					<IdentityAvatar
						avatar={item.avatar}
						className="size-11"
						fallback={Array.from(title)[0]?.toLocaleUpperCase() ?? title}
					/>
				) : null}
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="truncate font-semibold">{title}</h3>
						{item.queryStrategy ? (
							<Badge variant="secondary">
								{t.realms.taxonomy.strategies[item.queryStrategy].label}
							</Badge>
						) : null}
					</div>
					{(item.contextSummary ?? item.summary) ? (
						<p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
							{item.contextSummary ?? item.summary}
						</p>
					) : null}
				</div>
				<div className="flex items-center gap-1">
					{item.contentKind === "tag" && item.queryStrategy ? (
						<Button
							aria-pressed={selected}
							onClick={() => onSelectTag(item.contentUnitId)}
							size="sm"
							variant={selected ? "solid" : "outline"}
						>
							{t.realms.taxonomy.filter}
						</Button>
					) : null}
					{detailHref ? (
						<Button asChild aria-label={t.actions.view} size="icon-sm" variant="quiet">
							<Link href={detailHref}>
								<ChevronRightIcon aria-hidden />
							</Link>
						</Button>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}
