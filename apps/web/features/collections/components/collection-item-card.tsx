"use client";

import type { GetApiCollectionsByCollectionIdStatus200 } from "@rezics/openapi-tanstack-query";
import { Badge, Button, Card, CardAction, CardContent, CardHeader, Cover } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { toNonNegativeApiInteger } from "@/lib/api-number";

type CollectionItem = GetApiCollectionsByCollectionIdStatus200["items"][number];

export function CollectionItemCard({
	canManage,
	item,
	onRemove,
	removePending,
}: {
	canManage: boolean;
	item: CollectionItem;
	onRemove: () => void;
	removePending: boolean;
}) {
	const { t } = useTranslation(["engagement", "ui"]);
	const href = collectionItemHref(item.type, item.targetId);
	return (
		<Card>
			<div className={item.cover ? "grid grid-cols-[5rem_minmax(0,1fr)]" : undefined}>
				{item.cover ? (
					<CardContent className="p-3 pe-0">
						<Cover
							alt={item.title ?? t.ui.unnamed}
							className="rounded-lg border border-border-weak"
							src={item.cover.url}
						/>
					</CardContent>
				) : null}
				<CardHeader
					description={
						item.type === "collection" && item.directItemCount !== null
							? t.engagement.directItemCount({
									count: toNonNegativeApiInteger(item.directItemCount),
								})
							: item.type
					}
					title={item.title ?? t.ui.unnamed}
				>
					<CardAction>
						<div className="flex flex-wrap justify-end gap-2">
							{item.type === "collection" ? (
								<Badge variant="secondary">{t.engagement.nestedCollection}</Badge>
							) : null}
							{href ? (
								<Button asChild size="sm" variant="outline">
									<Link href={href}>{t.engagement.select}</Link>
								</Button>
							) : null}
							{canManage ? (
								<Button
									isLoading={removePending}
									onClick={onRemove}
									size="sm"
									variant="quiet"
								>
									{t.engagement.removeItem}
								</Button>
							) : null}
						</div>
					</CardAction>
				</CardHeader>
			</div>
		</Card>
	);
}

function collectionItemHref(type: string, id: string): string | undefined {
	switch (type.toLowerCase()) {
		case "book":
		case "software":
		case "media":
			return `/units/${type.toLowerCase()}/${id}`;
		case "entity":
			return `/entities/${id}`;
		case "post":
			return `/posts/${id}`;
		case "poll":
			return `/polls/${id}`;
		case "collection":
			return `/collections/${id}`;
		case "review":
			return `/reviews/${id}`;
		default:
			return undefined;
	}
}
