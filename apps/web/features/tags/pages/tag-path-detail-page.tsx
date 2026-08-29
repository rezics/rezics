"use client";

import {
	getApiTagPathsByPathIdQueryKey,
	useDeleteApiTagPathsByPathIdVote,
	useGetApiTagPathsByPathId,
	usePutApiTagPathsByPathIdVote,
} from "@rezics/openapi-tanstack-query";
import { Badge, Card, CardContent, PageHeading, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import { realmHref } from "@/features/slugs/unit-route";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { TagExpressionPreview } from "../components/tag-expression-preview";
import { TagPathPath } from "../components/tag-path";
import { TagPathSemanticCuration } from "../components/tag-path-semantic-curation";
import { TagReferenceBadge } from "../components/tag-reference-badge";
import { TagVoteControls } from "../components/tag-vote-controls";

export function TagPathDetailPage({ pathId }: { readonly pathId: string }) {
	const { data: session } = useHydratedSession();
	const { t } = useTranslation(["tags", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const queryInput = {
		path: { pathId },
		query: { localizationLanguages },
	} as const;
	const query = useGetApiTagPathsByPathId(queryInput);
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: getApiTagPathsByPathIdQueryKey(queryInput),
		});
	const vote = usePutApiTagPathsByPathIdVote({ mutation: { onSuccess: invalidate } });
	const clearVote = useDeleteApiTagPathsByPathIdVote({ mutation: { onSuccess: invalidate } });

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading title={t.tags.paths.title} />
			<section className="grid gap-4" aria-labelledby="tag-path-structure-title">
				<div className="grid gap-1">
					<h2 className="font-heading text-xl font-bold" id="tag-path-structure-title">
						{t.tags.semantics.structureTitle}
					</h2>
					<p className="text-sm text-muted-foreground">{t.tags.semantics.structureDescription}</p>
				</div>
				<Card>
					<CardContent className="grid gap-5 p-5 sm:p-6">
						<TagPathPath
							ariaLabel={t.tags.paths.pathLabel}
							fallback={t.tags.paths.memberFallback}
							members={query.data.members}
							relationLabel={(kind) => relationLabel(kind, t.tags.expressions)}
						/>
						<TagVoteControls
							canVote={Boolean(session)}
							isPending={vote.isPending || clearVote.isPending}
							onClear={() => clearVote.mutate({ path: { pathId } })}
							onVote={(value) =>
								vote.mutate({
									path: { pathId },
									body: { value },
								})
							}
							score={toFiniteApiNumber(query.data.score) ?? 0}
							viewerVote={query.data.viewerVote}
							voteCount={toNonNegativeApiInteger(query.data.voteCount)}
						/>
						<RequestFailure error={vote.error ?? clearVote.error} fallback={t.ui.retryLater} />
					</CardContent>
				</Card>
			</section>

			<section className="grid gap-4" aria-labelledby="tag-path-senses-title">
				<div className="grid gap-1">
					<h2 className="font-heading text-xl font-bold" id="tag-path-senses-title">
						{t.tags.semantics.sensesTitle}
					</h2>
					<p className="text-sm text-muted-foreground">{t.tags.semantics.sensesDescription}</p>
				</div>
				{query.data.senses.length ? (
					<div className="grid gap-4">
						{query.data.senses.map((sense) => (
							<Card key={sense.senseId}>
								<CardContent className="grid gap-5 p-5 sm:p-6">
									<div className="flex flex-wrap items-start justify-between gap-3">
										{sense.expression ? (
											<TagExpressionPreview compact={false} expressions={[sense.expression]} />
										) : (
											<span className="text-sm text-muted-foreground">{t.ui.unnamed}</span>
										)}
										<div className="flex flex-wrap gap-2">
											{sense.expression ? (
												<Badge variant="outline">
													{t.tags.semantics.expressionKinds[sense.expression.expressionKind]}
												</Badge>
											) : null}
											<Badge variant="secondary">
												{sense.scope === "global" ? (
													t.tags.semantics.globalScope
												) : sense.realmId ? (
													<Link href={realmHref({ id: sense.realmId })}>
														{sense.realmTitle ? (
															<LocalizedText
																language={sense.realmLanguage}
																value={sense.realmTitle}
															/>
														) : (
															t.tags.unnamedRealm
														)}
													</Link>
												) : (
													t.tags.semantics.realmScope
												)}
											</Badge>
											<Badge variant={sense.status === "active" ? "secondary" : "outline"}>
												{t.tags.semantics.statuses[sense.status]}
											</Badge>
										</div>
									</div>

									<div className="grid gap-2">
										<h3 className="text-sm font-semibold">{t.tags.semantics.bindingsTitle}</h3>
										<div className="flex flex-wrap gap-2">
											{sense.bindings.map((binding) => {
												const member = query.data.members[Number(binding.memberOrdinal)];
												return (
													<span
														className="inline-flex items-center gap-1 text-sm"
														key={`${binding.memberOrdinal}:${binding.argumentRole}:${binding.argumentOrdinal}`}
													>
														<Badge variant="outline">
															{member?.title ?? t.tags.paths.memberFallback}
														</Badge>
														<span aria-hidden="true" className="text-muted-foreground">
															→
														</span>
														<Badge variant="secondary">
															{t.tags.semantics.roles[binding.argumentRole]}
														</Badge>
													</span>
												);
											})}
										</div>
									</div>

									<div className="grid gap-3">
										<h3 className="text-sm font-semibold">
											{t.tags.semantics.inferenceRulesTitle}
										</h3>
										{sense.inferenceRules.length ? (
											<div className="grid gap-3">
												{sense.inferenceRules.map((rule) => (
													<div
														className="grid gap-3 rounded-lg border border-border-weak p-3"
														key={rule.ruleId}
													>
														<div className="flex flex-wrap items-center gap-2">
															<Badge variant="secondary">
																{t.tags.semantics.inferenceKinds[rule.inferenceKind]}
															</Badge>
															<Badge variant="outline">
																{t.tags.semantics.ruleRevision({ revision: Number(rule.revision) })}
															</Badge>
															<Badge variant={rule.status === "active" ? "secondary" : "outline"}>
																{t.tags.semantics.statuses[rule.status]}
															</Badge>
														</div>
														{rule.target.kind === "tag" ? (
															<TagReferenceBadge
																tagId={rule.target.tagId}
																title={rule.target.title ?? t.tags.unnamedTag}
															/>
														) : rule.target.expression ? (
															<TagExpressionPreview
																compact={false}
																expressions={[rule.target.expression]}
															/>
														) : (
															<span className="font-mono text-xs text-muted-foreground">
																{rule.target.expressionId}
															</span>
														)}
														{rule.provenance ? (
															<details className="text-xs text-muted-foreground">
																<summary className="cursor-pointer">
																	{t.tags.semantics.provenance}
																</summary>
																<pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2">
																	{JSON.stringify(rule.provenance, null, 2)}
																</pre>
															</details>
														) : null}
													</div>
												))}
											</div>
										) : (
											<p className="text-sm text-muted-foreground">
												{t.tags.semantics.noInferenceRules}
											</p>
										)}
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				) : (
					<p className="text-sm text-muted-foreground">{t.tags.semantics.noSenses}</p>
				)}
			</section>

			<TagPathSemanticCuration onChanged={() => void invalidate()} path={query.data} />
		</main>
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
