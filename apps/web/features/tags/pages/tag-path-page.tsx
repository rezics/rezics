"use client";

import { useGetApiTagsByTagIdHierarchy } from "@rezics/openapi-tanstack-query";
import { Badge, Card, CardContent, QueryFailure, QueryPending } from "@rezics/ui";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { TagDetailSectionFrame } from "../components/tag-detail-section-frame";
import { useTagDetail } from "../components/tag-detail-workspace";
import { tagDetailHref } from "../routing/tag-links";

export function TagPathPage() {
	const tag = useTagDetail();
	const { t } = useTranslation(["tags"]);
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiTagsByTagIdHierarchy({
		path: { tagId: tag.id },
		query: { localizationLanguages, childLimit: 100, grandchildLimit: 50 },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	return (
		<TagDetailSectionFrame
			description={t.tags.detail.pathsDescription}
			title={t.tags.detail.pathsTitle}
		>
			<section className="grid gap-4">
				<div className="grid gap-1">
					<h2 className="font-heading text-xl font-bold">{t.tags.detail.childrenTitle}</h2>
					<p className="text-sm text-muted-foreground">{t.tags.detail.childrenDescription}</p>
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
												<LocalizedText language={child.language} value={child.title} />
											) : (
												t.tags.unnamedTag
											)}
										</Link>
										{child.summary ? (
											<p className="text-sm text-muted-foreground">
												<LocalizedText language={child.language} value={child.summary} />
											</p>
										) : null}
										<p className="text-xs text-muted-foreground">
											{t.tags.vote.summary({
												score: String(toFiniteApiNumber(child.score) ?? 0),
												count: String(toNonNegativeApiInteger(child.voteCount)),
											})}
										</p>
									</div>
									{child.children.length ? (
										<div className="grid gap-2">
											<h3 className="text-sm font-medium">{t.tags.detail.grandchildrenTitle}</h3>
											<div className="flex flex-wrap gap-2">
												{child.children.map((grandchild) => (
													<Link href={tagDetailHref(grandchild.tagId)} key={grandchild.tagId}>
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
		</TagDetailSectionFrame>
	);
}
