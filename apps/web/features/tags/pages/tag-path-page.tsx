"use client";

import {
	getApiTagsByTagIdPaths,
	useGetApiTagsByTagIdExpressions,
	useGetApiTagsByTagIdHierarchy,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, Card, CardContent, QueryFailure, QueryPending } from "@rezics/ui";
import { useInfiniteQuery } from "@tanstack/react-query";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { TagDetailSectionFrame } from "../components/tag-detail-section-frame";
import { useTagDetail } from "../components/tag-detail-workspace";
import { TagExpressionPreview } from "../components/tag-expression-preview";
import { TagPathPath } from "../components/tag-path";
import { tagDetailHref, tagPathHref } from "../routing/tag-links";

export function TagPathPage() {
	const tag = useTagDetail();
	const { t } = useTranslation(["tags", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const hierarchy = useGetApiTagsByTagIdHierarchy({
		path: { tagId: tag.id },
		query: { localizationLanguages, childLimit: 100, grandchildLimit: 50 },
	});
	const expressions = useGetApiTagsByTagIdExpressions({
		path: { tagId: tag.id },
		query: { localizationLanguages, limit: 100 },
	});
	const paths = useInfiniteQuery({
		queryKey: ["tag-vocabulary-positions", tag.id, localizationLanguages],
		initialPageParam: null as string | null,
		queryFn: async ({ pageParam }) => {
			const response = await getApiTagsByTagIdPaths({
				path: { tagId: tag.id },
				query: {
					localizationLanguages,
					limit: 20,
					...(pageParam ? { cursor: pageParam } : {}),
				},
				throwOnError: true,
			});
			return response.data;
		},
		getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
	});
	if (hierarchy.isPending || expressions.isPending || paths.isPending) return <QueryPending />;
	if (hierarchy.isError || !hierarchy.data)
		return <QueryFailure error={hierarchy.error} retry={() => void hierarchy.refetch()} />;
	if (expressions.isError || !expressions.data)
		return <QueryFailure error={expressions.error} retry={() => void expressions.refetch()} />;
	if (paths.isError || !paths.data)
		return <QueryFailure error={paths.error} retry={() => void paths.refetch()} />;

	const pathItems = paths.data.pages.flatMap((page) => page.items);
	return (
		<TagDetailSectionFrame
			description={t.tags.detail.pathsDescription}
			title={t.tags.detail.pathsTitle}
		>
			<div className="grid gap-8">
				<SemanticSection
					description={t.tags.semantics.qualifiedDescription}
					title={t.tags.semantics.qualifiedTitle}
				>
					{expressions.data.qualifiedExpressions.length ? (
						<div className="grid gap-3 md:grid-cols-2">
							{expressions.data.qualifiedExpressions.map(({ expression, roles }) => (
								<Card key={expression.expressionId}>
									<CardContent className="grid gap-3 p-5">
										<TagExpressionPreview compact={false} expressions={[expression]} />
										<div className="flex flex-wrap gap-2">
											{roles.map((role) => (
												<Badge key={role} variant="outline">
													{t.tags.semantics.roles[role]}
												</Badge>
											))}
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					) : (
						<p className="text-sm text-muted-foreground">{t.tags.semantics.noQualified}</p>
					)}
				</SemanticSection>

				<SemanticSection
					description={t.tags.semantics.positionsDescription}
					title={t.tags.semantics.positionsTitle}
				>
					{pathItems.length ? (
						<div className="grid gap-3">
							{pathItems.map((path) => (
								<Card key={path.pathId}>
									<CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
										<TagPathPath
											ariaLabel={t.tags.paths.pathLabel}
											fallback={t.tags.paths.memberFallback}
											members={path.members}
											relationLabel={(kind) => relationLabel(kind, t.tags.expressions)}
										/>
										<Button asChild size="sm" variant="outline">
											<Link href={tagPathHref(path.pathId)}>{t.tags.paths.details}</Link>
										</Button>
									</CardContent>
								</Card>
							))}
							{paths.hasNextPage ? (
								<Button
									className="w-fit"
									isLoading={paths.isFetchingNextPage}
									onClick={() => void paths.fetchNextPage()}
									variant="outline"
								>
									{t.ui.showMore}
								</Button>
							) : null}
						</div>
					) : (
						<p className="text-sm text-muted-foreground">{t.tags.semantics.noPositions}</p>
					)}
				</SemanticSection>

				<SemanticSection
					description={t.tags.semantics.inferredReachDescription}
					title={t.tags.semantics.inferredReachTitle}
				>
					{expressions.data.inferredReach.length ? (
						<div className="grid gap-3 md:grid-cols-2">
							{expressions.data.inferredReach.map(({ evidenceKind, expression }) => (
								<Card key={`${expression.expressionId}:${evidenceKind}`}>
									<CardContent className="grid gap-3 p-5">
										<TagExpressionPreview compact={false} expressions={[expression]} />
										<Badge className="w-fit" variant="outline">
											{t.tags.searchMatches.evidence[evidenceKind]}
										</Badge>
									</CardContent>
								</Card>
							))}
						</div>
					) : (
						<p className="text-sm text-muted-foreground">{t.tags.semantics.noInferredReach}</p>
					)}
				</SemanticSection>

				<SemanticSection
					description={t.tags.detail.childrenDescription}
					title={t.tags.detail.childrenTitle}
				>
					{hierarchy.data.children.length ? (
						<div className="grid gap-3 md:grid-cols-2">
							{hierarchy.data.children.map((child) => (
								<Card key={child.relationId}>
									<CardContent className="grid gap-4 p-5">
										<div className="grid gap-1">
											<div className="flex flex-wrap items-center gap-2">
												{child.node.nodeKind === "concept" ? (
													<Link
														className="font-semibold text-link hover:text-link-hover hover:underline"
														href={tagDetailHref(child.node.nodeId)}
													>
														{child.node.title ? (
															<LocalizedText
																language={child.node.language}
																value={child.node.title}
															/>
														) : (
															t.tags.unnamedTag
														)}
													</Link>
												) : (
													<span className="font-semibold">
														{child.node.title ?? t.tags.paths.memberFallback}
													</span>
												)}
												<Badge variant="secondary">
													{relationLabel(child.relationKind, t.tags.expressions)}
												</Badge>
											</div>
											{child.node.summary ? (
												<p className="text-sm text-muted-foreground">
													<LocalizedText
														language={child.node.language}
														value={child.node.summary}
													/>
												</p>
											) : null}
										</div>
										{child.children.length ? (
											<div className="grid gap-2">
												<h3 className="text-sm font-medium">{t.tags.detail.grandchildrenTitle}</h3>
												<div className="flex flex-wrap gap-2">
													{child.children.map((grandchild) => {
														const label = grandchild.node.title ?? t.tags.paths.memberFallback;
														const badge = (
															<Badge variant="outline">
																{label} ·{" "}
																{relationLabel(grandchild.relationKind, t.tags.expressions)}
															</Badge>
														);
														return grandchild.node.nodeKind === "concept" ? (
															<Link
																href={tagDetailHref(grandchild.node.nodeId)}
																key={grandchild.relationId}
															>
																{badge}
															</Link>
														) : (
															<span key={grandchild.relationId}>{badge}</span>
														);
													})}
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
				</SemanticSection>
			</div>
		</TagDetailSectionFrame>
	);
}

function SemanticSection({
	children,
	description,
	title,
}: {
	readonly children: React.ReactNode;
	readonly description: string;
	readonly title: string;
}) {
	return (
		<section className="grid gap-4">
			<div className="grid gap-1">
				<h2 className="font-heading text-xl font-bold">{title}</h2>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
			{children}
		</section>
	);
}

function relationLabel(
	relation: string,
	copy: {
		readonly relationFallback: string;
		readonly relations: Readonly<Record<string, string>>;
	},
): string {
	return copy.relations[relation] ?? copy.relationFallback;
}
