"use client";

import { toContentLanguage } from "@rezics/i18n";
import { useGetApiTagsByTagId } from "@rezics/openapi-tanstack-query";
import { Badge, Card, CardContent, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { tagDetailHref } from "../routing/tag-links";

export function TagDetailPage({ tagId }: { readonly tagId: string }) {
	const { locale, t } = useTranslation(["tags", "ui"]);
	const query = useGetApiTagsByTagId({
		path: { tagId },
		query: {
			language: toContentLanguage(locale.target),
			childLimit: 100,
			grandchildLimit: 50,
		},
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={query.data.title ?? t.tags.unnamedTag} />
			{query.data.summary ? (
				<p className="max-w-3xl text-muted-foreground">{query.data.summary}</p>
			) : null}
			<section className="grid gap-4">
				<div className="grid gap-1">
					<h2 className="font-heading text-xl font-bold">
						{t.tags.detail.childrenTitle}
					</h2>
					<p className="text-sm text-muted-foreground">
						{t.tags.detail.childrenDescription}
					</p>
				</div>
				{query.data.children.length ? (
					<div className="grid gap-3 md:grid-cols-2">
						{query.data.children.map((child) => (
							<Card key={child.tagId}>
								<CardContent className="grid gap-4 p-5">
									<div className="grid gap-1">
										<Link
											className="font-semibold text-link hover:text-link-hover hover:underline"
											href={tagDetailHref(child.tagId)}
										>
											{child.title ?? t.tags.unnamedTag}
										</Link>
										{child.summary ? (
											<p className="text-sm text-muted-foreground">
												{child.summary}
											</p>
										) : null}
										<p className="text-xs text-muted-foreground">
											{t.tags.vote.summary({
												score: String(toFiniteApiNumber(child.score) ?? 0),
												count: String(
													toNonNegativeApiInteger(child.voteCount),
												),
											})}
										</p>
									</div>
									{child.children.length ? (
										<div className="grid gap-2">
											<h3 className="text-sm font-medium">
												{t.tags.detail.grandchildrenTitle}
											</h3>
											<div className="flex flex-wrap gap-2">
												{child.children.map((grandchild) => (
													<Link
														href={tagDetailHref(grandchild.tagId)}
														key={grandchild.tagId}
													>
														<Badge variant="outline">
															{grandchild.title ?? t.tags.unnamedTag}
														</Badge>
													</Link>
												))}
											</div>
										</div>
									) : null}
								</CardContent>
							</Card>
						))}
					</div>
				) : (
					<p className="text-sm text-muted-foreground">{t.tags.detail.noChildren}</p>
				)}
			</section>
		</main>
	);
}
