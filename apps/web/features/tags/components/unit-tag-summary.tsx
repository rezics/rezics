"use client";

import { toContentLanguage } from "@rezics/i18n";
import { useGetApiUnitsByTypeByUnitIdTags } from "@rezics/openapi-tanstack-query";
import { Badge, Button, Card, CardContent, QueryFailure, QueryPending } from "@rezics/ui";
import Link from "next/link";

import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { useTranslation } from "@/i18n/client";
import { tagSearchHref, unitTagsHref } from "../routing/tag-links";

export function UnitTagSummary({
	type,
	unitId,
}: {
	readonly type: CatalogDetailUnitType;
	readonly unitId: string;
}) {
	const { locale, t } = useTranslation(["tags", "ui"]);
	const query = useGetApiUnitsByTypeByUnitIdTags({
		path: { type, unitId },
		query: {
			language: toContentLanguage(locale.target),
			globalLimit: 8,
			sourceLimit: 3,
			perRealmLimit: 4,
		},
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const hasRealmTags = query.data.realms.some(
		(source) => source.votedTags.length || source.policyTags.length,
	);
	return (
		<Card>
			<CardContent className="grid gap-5 p-5 sm:p-6">
				<div className="grid gap-2">
					<h3 className="font-semibold">{t.tags.global.title}</h3>
					{query.data.global.length ? (
						<div className="flex flex-wrap gap-2">
							{query.data.global.map((tag) => {
								const label = tag.title ?? t.tags.unnamedTag;
								return (
									<Link
										href={tagSearchHref(type, tag.tagId, label)}
										key={tag.tagId}
									>
										<Badge variant={tag.pinned ? "secondary" : "outline"}>
											{label}
										</Badge>
									</Link>
								);
							})}
						</div>
					) : (
						<p className="text-sm text-muted-foreground">{t.tags.global.empty}</p>
					)}
				</div>

				{hasRealmTags ? (
					<div className="grid gap-3 border-t border-border-weak pt-4">
						<h3 className="font-semibold">{t.tags.realms.title}</h3>
						{query.data.realms.map((source) => {
							const tags = [...source.policyTags, ...source.votedTags];
							if (!tags.length) return null;
							return (
								<div className="grid gap-2" key={source.realmId}>
									<span className="text-sm font-medium">
										{source.title ?? t.tags.unnamedRealm}
									</span>
									<div className="flex flex-wrap gap-2">
										{tags.map((tag) => {
											const label = tag.title ?? t.tags.unnamedTag;
											return (
												<Link
													href={tagSearchHref(type, tag.tagId, label)}
													key={`${source.realmId}:${"contextPostId" in tag ? "vote" : "policy"}:${tag.tagId}`}
												>
													<Badge variant="outline">{label}</Badge>
												</Link>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>
				) : null}

				<Button asChild className="w-fit" variant="outline">
					<Link href={unitTagsHref(type, unitId)}>{t.tags.page.viewAll}</Link>
				</Button>
			</CardContent>
		</Card>
	);
}
