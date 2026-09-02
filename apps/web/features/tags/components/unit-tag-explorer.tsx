"use client";

import {
	getApiRealmsByRealmIdUnitsByUnitIdTagsQueryKey,
	getApiUnitsByTypeByUnitIdTagsQueryKey,
	useDeleteApiRealmsByRealmIdUnitsByUnitIdTagPathApplicationsByApplicationId,
	useDeleteApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote,
	useDeleteApiUnitsByTypeByUnitIdTagPathApplicationsByApplicationId,
	useDeleteApiUnitsByTypeByUnitIdTagsByTagIdVote,
	useGetApiRealmsByRealmIdUnitsByUnitIdTags,
	useGetApiUnitsByTypeByUnitId,
	useGetApiUnitsByTypeByUnitIdTags,
	usePostApiRealmsByRealmIdUnitsByUnitIdTagPathApplications,
	usePostApiUnitsByTypeByUnitIdTagPathApplications,
	usePutApiRealmsByRealmIdUnitsByUnitIdTagPathApplicationsByApplicationIdJudgment,
	usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote,
	usePutApiUnitsByTypeByUnitIdTagPathApplicationsByApplicationIdJudgment,
	usePutApiUnitsByTypeByUnitIdTagsByTagId,
	usePutApiUnitsByTypeByUnitIdTagsByTagIdVote,
} from "@rezics/openapi-tanstack-query";
import type { GetApiUnitsByTypeByUnitIdTagsStatus200 } from "@rezics/openapi-tanstack-query";
import type { Translation } from "@rezics/i18n";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import {
	presentRealmTagGroups,
	presentRealmTagVoteContexts,
	presentSelectedRealmTags,
} from "../data/unit-tag-presentation";
import {
	renderTagExpressions,
	type RenderedTagExpressionGroup,
	type TagExpressionAuthority,
} from "../model/tag-expression-renderer";
import type { TagPresentation, TagVoteContextSelection } from "../model/tag-presentation";
import type { TaggableUnitType } from "../model/taggable-unit";
import { resolveTagVoteContext, type TagVoteContextRequest } from "../model/tag-vote-context";
import { unitTagsHref } from "../routing/tag-links";
import { RealmTagContextHeading } from "./realm-tag-context-heading";
import { TagContextSection } from "./tag-context-section";
import { TagExpressionBadge, type UnitExpressionApplication } from "./tag-expression-badge";
import { TagVoteContextSelector } from "./tag-vote-context-selector";
import { UnitTagManagement } from "./unit-tag-management";

const SurfaceLimits = {
	section: { expressionLimit: 8, sourceLimit: 3, perRealmLimit: 4 },
	page: { expressionLimit: 100, sourceLimit: 30, perRealmLimit: 50 },
} as const;

const InitialTagVoteContext = { kind: "global" } as const satisfies TagVoteContextRequest;

export function UnitTagExplorer({
	highlightedTagId: _highlightedTagId,
	initialVoteContext = InitialTagVoteContext,
	surface,
	type,
	unitId,
}: {
	readonly highlightedTagId?: string;
	readonly initialVoteContext?: TagVoteContextRequest;
	readonly surface: "section" | "page";
	readonly type: TaggableUnitType;
	readonly unitId: string;
}) {
	const { data: session } = useHydratedSession();
	const { t } = useTranslation(["tags", "ui"]);
	const localizationLanguages = useLocalizationLanguages();
	const queryClient = useQueryClient();
	const [requestedVoteContext, setRequestedVoteContext] =
		useState<TagVoteContextRequest>(initialVoteContext);
	const queryInput = {
		path: { type, unitId },
		query: {
			localizationLanguages,
			includeExpressions: true,
			...SurfaceLimits[surface],
		},
	} as const;
	const query = useGetApiUnitsByTypeByUnitIdTags(queryInput);
	const unitQuery = useGetApiUnitsByTypeByUnitId(
		{
			path: { type: type === "entity" ? "media" : type, unitId },
			query: { localizationLanguages },
		},
		{ query: { enabled: surface === "page" && type !== "entity" } },
	);
	const voteRealms = query.data ? presentRealmTagVoteContexts(query.data) : [];
	const activeVoteContext = resolveTagVoteContext(requestedVoteContext, voteRealms);
	const activeRealmId = activeVoteContext.kind === "realm" ? activeVoteContext.realm.realmId : "";
	const activeRealmTagsQuery = useGetApiRealmsByRealmIdUnitsByUnitIdTags(
		{
			path: { realmId: activeRealmId, unitId },
			query: { localizationLanguages, limit: SurfaceLimits.page.perRealmLimit },
		},
		{ query: { enabled: surface === "page" && activeVoteContext.kind === "realm" } },
	);

	const invalidateLandscape = () =>
		queryClient.invalidateQueries({
			queryKey: getApiUnitsByTypeByUnitIdTagsQueryKey({ path: { type, unitId } }),
		});
	const invalidateRealm = (realmId: string) =>
		Promise.all([
			invalidateLandscape(),
			queryClient.invalidateQueries({
				queryKey: getApiRealmsByRealmIdUnitsByUnitIdTagsQueryKey({
					path: { realmId, unitId },
				}),
			}),
		]);

	const addDirect = usePutApiUnitsByTypeByUnitIdTagsByTagId();
	const addRealmDirect = usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote();
	const globalVote = usePutApiUnitsByTypeByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: invalidateLandscape },
	});
	const clearGlobalVote = useDeleteApiUnitsByTypeByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: invalidateLandscape },
	});
	const realmVote = usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: (_data, variables) => invalidateRealm(variables.path.realmId) },
	});
	const clearRealmVote = useDeleteApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: (_data, variables) => invalidateRealm(variables.path.realmId) },
	});
	const applyGlobalPath = usePostApiUnitsByTypeByUnitIdTagPathApplications();
	const judgeGlobalPath = usePutApiUnitsByTypeByUnitIdTagPathApplicationsByApplicationIdJudgment({
		mutation: { onSuccess: invalidateLandscape },
	});
	const removeGlobalPath = useDeleteApiUnitsByTypeByUnitIdTagPathApplicationsByApplicationId({
		mutation: { onSuccess: invalidateLandscape },
	});
	const applyRealmPath = usePostApiRealmsByRealmIdUnitsByUnitIdTagPathApplications();
	const judgeRealmPath =
		usePutApiRealmsByRealmIdUnitsByUnitIdTagPathApplicationsByApplicationIdJudgment({
			mutation: { onSuccess: (_data, variables) => invalidateRealm(variables.path.realmId) },
		});
	const removeRealmPath =
		useDeleteApiRealmsByRealmIdUnitsByUnitIdTagPathApplicationsByApplicationId({
			mutation: { onSuccess: (_data, variables) => invalidateRealm(variables.path.realmId) },
		});

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const realmGroups = presentRealmTagGroups({ data: query.data, unitId });
	const activeRealmTags =
		activeVoteContext.kind === "realm" && activeRealmTagsQuery.data
			? presentSelectedRealmTags({
					context: activeVoteContext.realm,
					data: activeRealmTagsQuery.data,
					unitId,
				})
			: [];
	const realmTitleById = new Map(
		[...query.data.realms, ...query.data.voteRealms].map((realm) => [
			realm.realmId,
			realm.title ?? t.tags.unnamedRealm,
		]),
	);
	const expressionSections = expressionAuthoritySections(query.data.expressions, realmTitleById, t);
	const canCurateGlobal = Boolean(unitQuery.data?.capabilities.canCurateTags);

	const voteOnApplication = (application: UnitExpressionApplication, value: -1 | 1) => {
		if (application.sourceKind === "direct" && application.tagId) {
			if (application.authority.kind === "global")
				globalVote.mutate({ path: { type, unitId, tagId: application.tagId }, body: { value } });
			else
				realmVote.mutate({
					path: {
						realmId: application.authority.realmId,
						unitId,
						tagId: application.tagId,
					},
					body: { value },
				});
			return;
		}
		if (!application.applicationId) return;
		if (application.authority.kind === "global")
			judgeGlobalPath.mutate({
				path: { type, unitId, applicationId: application.applicationId },
				body: { fitVote: value },
			});
		else
			judgeRealmPath.mutate({
				path: {
					realmId: application.authority.realmId,
					unitId,
					applicationId: application.applicationId,
				},
				body: { fitVote: value },
			});
	};
	const clearApplicationJudgment = (application: UnitExpressionApplication) => {
		if (application.sourceKind === "direct" && application.tagId) {
			if (application.authority.kind === "global")
				clearGlobalVote.mutate({ path: { type, unitId, tagId: application.tagId } });
			else
				clearRealmVote.mutate({
					path: {
						realmId: application.authority.realmId,
						unitId,
						tagId: application.tagId,
					},
				});
			return;
		}
		if (!application.applicationId) return;
		if (application.authority.kind === "global")
			judgeGlobalPath.mutate({
				path: { type, unitId, applicationId: application.applicationId },
				body: { fitVote: null },
			});
		else
			judgeRealmPath.mutate({
				path: {
					realmId: application.authority.realmId,
					unitId,
					applicationId: application.applicationId,
				},
				body: { fitVote: null },
			});
	};
	const changeApplicationSpoiler = (
		application: UnitExpressionApplication,
		spoilerLevel: 0 | 1 | 2 | null,
	) => {
		if (!application.applicationId || application.sourceKind !== "path") return;
		if (application.authority.kind === "global")
			judgeGlobalPath.mutate({
				path: { type, unitId, applicationId: application.applicationId },
				body: { spoilerLevel },
			});
		else
			judgeRealmPath.mutate({
				path: {
					realmId: application.authority.realmId,
					unitId,
					applicationId: application.applicationId,
				},
				body: { spoilerLevel },
			});
	};
	const removeApplication = (application: UnitExpressionApplication) => {
		if (!application.applicationId || application.sourceKind !== "path") return;
		if (application.authority.kind === "global")
			removeGlobalPath.mutate({
				path: { type, unitId, applicationId: application.applicationId },
			});
		else
			removeRealmPath.mutate({
				path: {
					realmId: application.authority.realmId,
					unitId,
					applicationId: application.applicationId,
				},
			});
	};
	const applicationPending = (application: UnitExpressionApplication) => {
		if (application.sourceKind === "direct" && application.tagId) {
			if (application.authority.kind === "global")
				return [globalVote, clearGlobalVote].some(
					(mutation) => mutation.isPending && mutation.variables?.path.tagId === application.tagId,
				);
			const realmId = application.authority.realmId;
			return [realmVote, clearRealmVote].some(
				(mutation) =>
					mutation.isPending &&
					mutation.variables?.path.realmId === realmId &&
					mutation.variables.path.tagId === application.tagId,
			);
		}
		if (!application.applicationId) return false;
		return application.authority.kind === "global"
			? [judgeGlobalPath, removeGlobalPath].some(
					(mutation) =>
						mutation.isPending &&
						mutation.variables?.path.applicationId === application.applicationId,
				)
			: [judgeRealmPath, removeRealmPath].some(
					(mutation) =>
						mutation.isPending &&
						mutation.variables?.path.applicationId === application.applicationId,
				);
	};
	const voteOnTagContext = (item: TagPresentation, value: -1 | 1) => {
		if (item.vote.kind !== "available") return;
		const target = item.vote.target;
		if (target.kind === "global")
			globalVote.mutate({ path: { type, unitId, tagId: target.tagId }, body: { value } });
		else
			realmVote.mutate({
				path: { realmId: target.realmId, unitId, tagId: target.tagId },
				body: { value },
			});
	};
	const clearTagContextVote = (item: TagPresentation) => {
		if (item.vote.kind !== "available") return;
		const target = item.vote.target;
		if (target.kind === "global")
			clearGlobalVote.mutate({ path: { type, unitId, tagId: target.tagId } });
		else
			clearRealmVote.mutate({
				path: { realmId: target.realmId, unitId, tagId: target.tagId },
			});
	};
	const setVoteContext = (context: TagVoteContextSelection) =>
		setRequestedVoteContext(
			context.kind === "global"
				? { kind: "global" }
				: { kind: "realm", realmId: context.realm.realmId },
		);
	const mutationError =
		judgeGlobalPath.error ??
		removeGlobalPath.error ??
		judgeRealmPath.error ??
		removeRealmPath.error ??
		globalVote.error ??
		clearGlobalVote.error ??
		realmVote.error ??
		clearRealmVote.error;

	return (
		<div className="grid gap-7">
			<section className="grid gap-5">
				<div className="grid gap-1">
					<h2 className={surface === "page" ? "font-heading text-xl font-bold" : "font-semibold"}>
						{t.tags.expressions.title}
					</h2>
					<p className="text-sm leading-6 text-muted-foreground">
						{t.tags.expressions.description}
					</p>
				</div>
				{expressionSections.length ? (
					<div className="grid gap-6">
						{expressionSections.map((section) => (
							<ExpressionAuthoritySection
								canCurate={section.authority.kind === "global" && canCurateGlobal}
								canVote={Boolean(session)}
								groups={section.groups}
								isPending={applicationPending}
								key={section.key}
								onClearJudgment={clearApplicationJudgment}
								onRemoveApplication={removeApplication}
								onSpoilerChange={changeApplicationSpoiler}
								onVote={voteOnApplication}
								title={section.title}
								type={type}
							/>
						))}
					</div>
				) : (
					<p className="text-sm text-muted-foreground">{t.tags.expressions.empty}</p>
				)}
				{surface === "section" &&
				Number(query.data.totals.expressions) > query.data.expressions.length ? (
					<Button asChild className="w-fit" size="sm" variant="quiet">
						<Link href={unitTagsHref(type, unitId)}>
							{t.tags.page.more({
								count: Number(query.data.totals.expressions) - query.data.expressions.length,
							})}
						</Link>
					</Button>
				) : null}
			</section>

			{surface === "page" ? (
				<section className="grid gap-5 border-t border-border-weak pt-6">
					<div className="grid gap-3">
						<div className="grid gap-1">
							<h2 className="font-heading text-xl font-bold">{t.tags.voteContext.title}</h2>
							<p className="text-sm leading-6 text-muted-foreground">
								{t.tags.voteContext.description}
							</p>
						</div>
						<TagVoteContextSelector
							onValueChange={setVoteContext}
							realms={voteRealms}
							value={activeVoteContext}
						/>
					</div>
					{activeVoteContext.kind === "realm" ? (
						activeRealmTagsQuery.isPending ? (
							<QueryPending />
						) : activeRealmTagsQuery.isError ? (
							<QueryFailure
								error={activeRealmTagsQuery.error}
								retry={() => void activeRealmTagsQuery.refetch()}
							/>
						) : (
							<TagContextSection
								empty={t.tags.realms.empty}
								fallbackLabel={t.tags.unnamedTag}
								heading={
									<RealmTagContextHeading
										fallbackTitle={t.tags.unnamedRealm}
										realm={activeVoteContext.realm}
									/>
								}
								items={activeRealmTags}
								onClearVote={clearTagContextVote}
								onToggleSelected={() => undefined}
								onVote={voteOnTagContext}
								selectedTagIds={new Set()}
								selectionMode={false}
								title={activeVoteContext.realm.title ?? t.tags.unnamedRealm}
								type={type}
							/>
						)
					) : null}
					<UnitTagManagement
						canVote={Boolean(session)}
						key={activeVoteContext.kind === "global" ? "global" : activeVoteContext.realm.realmId}
						onAddSelections={async (selections) => {
							const results: Array<
								| { readonly selectionKey: string; readonly status: "added" }
								| {
										readonly selectionKey: string;
										readonly status: "failed";
										readonly error: unknown;
								  }
							> = [];
							for (let offset = 0; offset < selections.length; offset += 4) {
								const batch = selections.slice(offset, offset + 4);
								results.push(
									...(await Promise.all(
										batch.map(async (selection) => {
											try {
												if (selection.kind === "direct_expression") {
													if (activeVoteContext.kind === "global")
														await addDirect.mutateAsync({
															path: { type, unitId, tagId: selection.tagId },
															body: {},
														});
													else
														await addRealmDirect.mutateAsync({
															path: {
																realmId: activeVoteContext.realm.realmId,
																unitId,
																tagId: selection.tagId,
															},
															body: { value: 1 },
														});
												} else {
													if (activeVoteContext.kind === "global")
														await applyGlobalPath.mutateAsync({
															path: { type, unitId },
															body: { senseId: selection.senseId, fitVote: 1 },
														});
													else
														await applyRealmPath.mutateAsync({
															path: {
																realmId: activeVoteContext.realm.realmId,
																unitId,
															},
															body: { senseId: selection.senseId, fitVote: 1 },
														});
												}
												return { selectionKey: selection.selectionKey, status: "added" as const };
											} catch (error) {
												return {
													selectionKey: selection.selectionKey,
													status: "failed" as const,
													error,
												};
											}
										}),
									)),
								);
							}
							if (results.some(({ status }) => status === "added")) {
								if (activeVoteContext.kind === "global") await invalidateLandscape();
								else await invalidateRealm(activeVoteContext.realm.realmId);
							}
							return results;
						}}
						tagCreateTarget={{
							type,
							unitId,
							context:
								activeVoteContext.kind === "global"
									? { kind: "global" }
									: { kind: "realm", realmId: activeVoteContext.realm.realmId },
						}}
					/>
				</section>
			) : null}

			{realmGroups.length ? (
				<section className="grid gap-5 border-t border-border-weak pt-6">
					<div className="grid gap-1">
						<h2 className={surface === "page" ? "font-heading text-xl font-bold" : "font-semibold"}>
							{t.tags.realms.title}
						</h2>
						<p className="text-sm text-muted-foreground">{t.tags.realms.description}</p>
					</div>
					<div className="grid gap-6">
						{realmGroups.map((group) => (
							<TagContextSection
								description={group.summary}
								descriptionLanguage={group.summary ? group.language : null}
								empty={t.tags.realms.empty}
								fallbackLabel={t.tags.unnamedTag}
								heading={
									<RealmTagContextHeading fallbackTitle={t.tags.unnamedRealm} realm={group} />
								}
								items={group.tags}
								key={group.realmId}
								onClearVote={clearTagContextVote}
								onToggleSelected={() => undefined}
								onVote={voteOnTagContext}
								selectedTagIds={new Set()}
								selectionMode={false}
								title={group.title ?? t.tags.unnamedRealm}
								titleLanguage={group.title ? group.language : null}
								type={type}
							/>
						))}
					</div>
				</section>
			) : null}

			<RequestFailure error={mutationError} fallback={t.ui.retryLater} />
			{surface === "section" ? (
				<Button asChild className="w-fit" variant="outline">
					<Link href={unitTagsHref(type, unitId)}>{t.tags.page.viewAll}</Link>
				</Button>
			) : null}
		</div>
	);
}

function authorityKey(authority: TagExpressionAuthority): string {
	return authority.kind === "global" ? "global" : `realm:${authority.realmId}`;
}

function expressionAuthoritySections(
	expressions: GetApiUnitsByTypeByUnitIdTagsStatus200["expressions"],
	realmTitleById: ReadonlyMap<string, string>,
	t: Pick<Translation, "tags">,
): readonly {
	readonly key: string;
	readonly title: string;
	readonly authority: TagExpressionAuthority;
	readonly groups: readonly RenderedTagExpressionGroup<UnitExpressionApplication>[];
}[] {
	const byAuthority = new Map<
		string,
		{
			readonly authority: TagExpressionAuthority;
			readonly expressions: Array<(typeof expressions)[number]>;
		}
	>();
	for (const expression of expressions) {
		const key = authorityKey(expression.authority);
		const current = byAuthority.get(key);
		if (current) current.expressions.push(expression);
		else byAuthority.set(key, { authority: expression.authority, expressions: [expression] });
	}
	return [...byAuthority.entries()].map(([key, section]) => {
		const title =
			section.authority.kind === "global"
				? t.tags.global.title
				: (realmTitleById.get(section.authority.realmId) ?? t.tags.unnamedRealm);
		return {
			key,
			title,
			authority: section.authority,
			groups: renderTagExpressions(section.expressions, {
				unknownLabel: t.tags.unnamedTag,
				groupByExpressionKey: true,
				authorityLabel: () => title,
				relationLabel: (relation) =>
					t.tags.expressions.relations[relation as keyof typeof t.tags.expressions.relations] ??
					t.tags.expressions.relationFallback,
			}),
		};
	});
}

function ExpressionAuthoritySection({
	canCurate,
	canVote,
	groups,
	isPending,
	onClearJudgment,
	onRemoveApplication,
	onSpoilerChange,
	onVote,
	title,
	type,
}: {
	readonly canCurate: boolean;
	readonly canVote: boolean;
	readonly groups: readonly RenderedTagExpressionGroup<UnitExpressionApplication>[];
	readonly isPending: (application: UnitExpressionApplication) => boolean;
	readonly onClearJudgment: (application: UnitExpressionApplication) => void;
	readonly onRemoveApplication: (application: UnitExpressionApplication) => void;
	readonly onSpoilerChange: (
		application: UnitExpressionApplication,
		value: 0 | 1 | 2 | null,
	) => void;
	readonly onVote: (application: UnitExpressionApplication, value: -1 | 1) => void;
	readonly title: string;
	readonly type: TaggableUnitType;
}) {
	const { t } = useTranslation(["tags"]);
	return (
		<section className="grid gap-4">
			<h3 className="font-semibold">{title}</h3>
			<div className="grid gap-4">
				{groups.map((group) => (
					<div className="grid gap-2" key={group.key}>
						{group.groupKey ? (
							<h4 className="text-sm font-medium text-muted-foreground">{group.groupKey.title}</h4>
						) : null}
						<div className="flex flex-wrap gap-2">
							{group.items.map((item) => (
								<TagExpressionBadge
									authorityLabel={title}
									canCurate={canCurate}
									canVote={canVote}
									isPending={isPending}
									item={item}
									key={item.key}
									onClearJudgment={onClearJudgment}
									onRemoveApplication={onRemoveApplication}
									onSpoilerChange={onSpoilerChange}
									onVote={onVote}
									type={type}
								/>
							))}
						</div>
					</div>
				))}
			</div>
			<span className="sr-only">{t.tags.expressions.authoritySection({ authority: title })}</span>
		</section>
	);
}
