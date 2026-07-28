"use client";

import { useGetApiTagsByTagId } from "@rezics/openapi-tanstack-query";
import { Badge, Card, CardContent, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import Link from "next/link";

import {
	LocalizedText,
	useChineseContentText,
} from "@/features/content-language-display/chinese-content-display-context";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { tagDetailHref } from "../routing/tag-links";

export function TagDetailPage({ tagId }: { readonly tagId: string }) {
	const { t } = useTranslation(["tags", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiTagsByTagId({
		path: { tagId },
		query: {
			localizationLanguages,
			childLimit: 100,
			grandchildLimit: 50,
		},
	});
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId: tagId,
	});
	const displayedTitle = useChineseContentText(
		query.data?.title ?? t.tags.unnamedTag,
		query.data?.title ? query.data.language : null,
	);
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={displayedTitle} />
			{query.data.summary ? (
				<p className="max-w-3xl text-muted-foreground">
					<LocalizedText language={query.data.language} value={query.data.summary} />
				</p>
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
											{child.title ? (
												<LocalizedText
													language={child.language}
													value={child.title}
												/>
											) : (
												t.tags.unnamedTag
											)}
										</Link>
										{child.summary ? (
											<p className="text-sm text-muted-foreground">
												<LocalizedText
													language={child.language}
													value={child.summary}
												/>
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
															{grandchild.title ? (
																<LocalizedText
																	language={grandchild.language}
																	value={grandchild.title}
																/>
															) : (
																t.tags.unnamedTag
															)}
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
