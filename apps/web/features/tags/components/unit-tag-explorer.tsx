"use client";

import {
	getApiRealmsByRealmIdUnitsByUnitIdTagsQueryKey,
	getApiRealmsByRealmIdTagPathsQueryKey,
	getApiUnitsByTypeByUnitIdTagsQueryKey,
	useDeleteApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote,
	useDeleteApiRealmsByRealmIdUnitsByUnitIdTagPathsByPathIdJudgment,
	useDeleteApiUnitsByTypeByUnitIdTagPathsByPathIdJudgment,
	useDeleteApiUnitsByTypeByUnitIdTagsByTagIdVote,
	useGetApiRealmsByRealmIdUnitsByUnitIdTags,
	useGetApiRealmsByRealmIdTagPaths,
	useGetApiUnitsByTypeByUnitIdTags,
	usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote,
	usePutApiRealmsByRealmIdUnitsByUnitIdTagPathsByPathId,
	usePutApiRealmsByRealmIdUnitsByUnitIdTagPathsByPathIdJudgment,
	usePutApiUnitsByTypeByUnitIdTagPathsByPathId,
	usePutApiUnitsByTypeByUnitIdTagPathsByPathIdJudgment,
	usePutApiUnitsByTypeByUnitIdTagsByTagId,
	usePutApiUnitsByTypeByUnitIdTagsByTagIdVote,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useReducer, useRef, useState } from "react";

import type { UnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { useTranslation } from "@/i18n/client";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import {
	presentGlobalTags,
	presentRealmTagGroups,
	presentRealmTagVoteContexts,
	presentSelectedRealmTags,
} from "../data/unit-tag-presentation";
import type {
	TagIdentity,
	TagPresentation,
	TagVoteContextSelection,
	TagVoteTarget,
} from "../model/tag-presentation";
import { InitialTagSelectionState, tagSelectionReducer } from "../model/tag-selection";
import type { TaggableUnitType } from "../model/taggable-unit";
import {
	resolveTagVoteContext,
	type TagVoteContextRequest,
	visibleTagDetailContexts,
} from "../model/tag-vote-context";
import { unitTagsHref } from "../routing/tag-links";
import { TagContextSection } from "./tag-context-section";
import { RealmTagContextHeading } from "./realm-tag-context-heading";
import { TagSelectionToolbar } from "./tag-selection-toolbar";
import { presentPathMembers, TagPathList } from "./tag-path-list";
import { TagVoteContextSelector } from "./tag-vote-context-selector";
import { UnitTagManagement } from "./unit-tag-management";

const SurfaceLimits = {
	section: {
		globalLimit: 8,
		pathLimit: 4,
		sourceLimit: 3,
		perRealmLimit: 4,
	},
	page: {
		globalLimit: 100,
		pathLimit: 50,
		sourceLimit: 30,
		perRealmLimit: 50,
	},
} as const;

const InitialTagVoteContext = { kind: "global" } as const satisfies TagVoteContextRequest;

export function UnitTagExplorer({
	highlightedTagId,
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
	const workUnitType: UnitDetailUnitType | null = type === "entity" ? null : type;
	const [requestedVoteContext, setRequestedVoteContext] =
		useState<TagVoteContextRequest>(initialVoteContext);
	const [selection, dispatchSelection] = useReducer(tagSelectionReducer, InitialTagSelectionState);
	const selectionLabels = useRef(new Map<string, string>());
	const queryInput = {
		path: { type, unitId },
		query: {
			localizationLanguages,
			...SurfaceLimits[surface],
		},
	} as const;
	const query = useGetApiUnitsByTypeByUnitIdTags(queryInput);
	const voteRealms = query.data ? presentRealmTagVoteContexts(query.data) : [];
	const activeVoteContext = resolveTagVoteContext(requestedVoteContext, voteRealms);
	const activeRealmId = activeVoteContext.kind === "realm" ? activeVoteContext.realm.realmId : "";
	const activeRealmTagsQuery = useGetApiRealmsByRealmIdUnitsByUnitIdTags(
		{
			path: { realmId: activeRealmId, unitId },
			query: {
				localizationLanguages,
				limit: SurfaceLimits.page.perRealmLimit,
			},
		},
		{
			query: {
				enabled: surface === "page" && activeVoteContext.kind === "realm",
			},
		},
	);
	const activeRealmPathsQuery = useGetApiRealmsByRealmIdTagPaths(
		{
			path: { realmId: activeRealmId },
			query: {
				unitId,
				localizationLanguages,
				limit: SurfaceLimits.page.pathLimit,
			},
		},
		{
			query: {
				enabled: surface === "page" && activeVoteContext.kind === "realm",
			},
		},
	);
	const invalidateLandscape = () =>
		queryClient.invalidateQueries({
			queryKey: getApiUnitsByTypeByUnitIdTagsQueryKey({
				path: queryInput.path,
			}),
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
	const invalidateRealmPaths = (realmId: string) =>
		Promise.all([
			invalidateRealm(realmId),
			queryClient.invalidateQueries({
				queryKey: getApiRealmsByRealmIdTagPathsQueryKey({
					path: { realmId },
				}),
			}),
		]);
	const add = usePutApiUnitsByTypeByUnitIdTagsByTagId({
		mutation: { onSuccess: invalidateLandscape },
	});
	const addPath = usePutApiUnitsByTypeByUnitIdTagPathsByPathId({
		mutation: { onSuccess: invalidateLandscape },
	});
	const pathJudgment = usePutApiUnitsByTypeByUnitIdTagPathsByPathIdJudgment({
		mutation: { onSuccess: invalidateLandscape },
	});
	const clearPathJudgment = useDeleteApiUnitsByTypeByUnitIdTagPathsByPathIdJudgment({
		mutation: { onSuccess: invalidateLandscape },
	});
	const globalVote = usePutApiUnitsByTypeByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: invalidateLandscape },
	});
	const clearGlobalVote = useDeleteApiUnitsByTypeByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: invalidateLandscape },
	});
	const realmVote = usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote({
		mutation: {
			onSuccess: (_data, variables) => invalidateRealm(variables.path.realmId),
		},
	});
	const clearRealmVote = useDeleteApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote({
		mutation: {
			onSuccess: (_data, variables) => invalidateRealm(variables.path.realmId),
		},
	});
	const applyRealmPath = usePutApiRealmsByRealmIdUnitsByUnitIdTagPathsByPathId({
		mutation: {
			onSuccess: (_data, variables) => invalidateRealmPaths(variables.path.realmId),
		},
	});
	const realmPathJudgment = usePutApiRealmsByRealmIdUnitsByUnitIdTagPathsByPathIdJudgment({
		mutation: {
			onSuccess: (_data, variables) => invalidateRealmPaths(variables.path.realmId),
		},
	});
	const clearRealmPathJudgment = useDeleteApiRealmsByRealmIdUnitsByUnitIdTagPathsByPathIdJudgment({
		mutation: {
			onSuccess: (_data, variables) => invalidateRealmPaths(variables.path.realmId),
		},
	});

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const globalTags = presentGlobalTags({
		data: query.data,
		type,
		unitId,
		signedIn: Boolean(session),
	});
	const compactHiddenCount = Math.max(
		0,
		query.data.totals.paths +
			query.data.totals.global -
			query.data.paths.length -
			globalTags.length,
	);
	const realmGroups = presentRealmTagGroups({ data: query.data, unitId });
	const activeTags =
		activeVoteContext.kind === "global"
			? globalTags
			: activeRealmTagsQuery.data
				? presentSelectedRealmTags({
						context: activeVoteContext.realm,
						data: activeRealmTagsQuery.data,
						unitId,
					})
				: [];
	const detailContexts = visibleTagDetailContexts(activeVoteContext, realmGroups);
	const identities = new Map<string, TagIdentity>();
	for (const item of globalTags) identities.set(item.identity.tagId, item.identity);
	if (workUnitType)
		for (const path of query.data.paths)
			for (const item of presentPathMembers(path))
				identities.set(item.identity.tagId, item.identity);
	for (const group of realmGroups)
		for (const item of group.tags) identities.set(item.identity.tagId, item.identity);
	for (const item of activeTags) identities.set(item.identity.tagId, item.identity);
	const selectedTagIds = new Set(selection.selectedTagIds);
	const selectionMode = selection.mode === "selecting";
	const pendingItemKey = pendingTagItemKey({
		globalVote,
		clearGlobalVote,
		realmVote,
		clearRealmVote,
	});
	const toggleSelected = (tagId: string, label: string) => {
		selectionLabels.current.set(tagId, label);
		dispatchSelection(selectionMode ? { type: "toggle", tagId } : { type: "enter", tagId });
	};
	const vote = (item: TagPresentation, value: -1 | 1) => {
		if (item.vote.kind !== "available" || !item.vote.canVote) return;
		voteOnTarget(item.vote.target, value, { globalVote, realmVote });
	};
	const clearVote = (item: TagPresentation) => {
		if (item.vote.kind !== "available" || !item.vote.canVote) return;
		clearVoteOnTarget(item.vote.target, { clearGlobalVote, clearRealmVote });
	};
	const groupHeadingLevel = surface === "page" ? "h3" : "h4";
	const setVoteContext = (context: TagVoteContextSelection) =>
		setRequestedVoteContext(
			context.kind === "global"
				? { kind: "global" }
				: { kind: "realm", realmId: context.realm.realmId },
		);
	const globalPathSection =
		workUnitType && query.data.paths.length ? (
			<div className="grid gap-3">
				{surface === "page" ? (
					<h3 className="font-semibold">{t.tags.paths.title}</h3>
				) : (
					<h4 className="font-semibold">{t.tags.paths.title}</h4>
				)}
				<TagPathList
					canVote={Boolean(session)}
					isPending={(pathId) =>
						(pathJudgment.isPending && pathJudgment.variables?.path.pathId === pathId) ||
						(clearPathJudgment.isPending && clearPathJudgment.variables?.path.pathId === pathId)
					}
					onClearPathJudgment={(pathId) =>
						clearPathJudgment.mutate({
							path: { type: workUnitType, unitId, pathId },
						})
					}
					onClearTagVote={clearVote}
					onPathJudgment={(pathId, body) =>
						pathJudgment.mutate({
							path: { type: workUnitType, unitId, pathId },
							body,
						})
					}
					onTagVote={vote}
					onToggleSelected={toggleSelected}
					selectedTagIds={selectedTagIds}
					selectionMode={selectionMode}
					paths={query.data.paths}
					surface={surface}
					type={workUnitType}
				/>
			</div>
		) : null;
	const realmPathApplications =
		activeRealmPathsQuery.data?.items.flatMap((item) => {
			const application = item.application;
			return application
				? [
						{
							pathId: item.pathId,
							pinned: false,
							position: null,
							score: application.fit.score,
							voteCount: application.fit.voteCount,
							viewerVote: application.fit.viewerVote,
							spoilerVoteCount: application.spoiler.voteCount,
							spoilerDistribution: application.spoiler.distribution,
							viewerSpoilerLevel: application.spoiler.viewerLevel,
							definitionScore: item.definition.score,
							definitionVoteCount: item.definition.voteCount,
							usageCount: item.definition.usageCount,
							members: item.members,
							createdAt: item.createdAt,
							updatedAt: item.createdAt,
						},
					]
				: [];
		}) ?? [];
	const realmPathById = new Map(
		activeRealmPathsQuery.data?.items.map((item) => [item.pathId, item] as const) ?? [],
	);
	const realmPathSection =
		activeVoteContext.kind === "realm" && workUnitType ? (
			<div className="grid gap-3">
				<h3 className="font-semibold">{t.tags.realms.pathsTitle}</h3>
				{activeRealmPathsQuery.isPending ? (
					<QueryPending />
				) : activeRealmPathsQuery.isError ? (
					<QueryFailure
						error={activeRealmPathsQuery.error}
						retry={() => void activeRealmPathsQuery.refetch()}
					/>
				) : (
					<>
						<TagPathList
							canVote={Boolean(session)}
							isPending={(pathId) =>
								(realmPathJudgment.isPending &&
									realmPathJudgment.variables?.path.pathId === pathId) ||
								(clearRealmPathJudgment.isPending &&
									clearRealmPathJudgment.variables?.path.pathId === pathId)
							}
							onClearPathJudgment={(pathId) =>
								clearRealmPathJudgment.mutate({
									path: {
										realmId: activeVoteContext.realm.realmId,
										unitId,
										pathId,
									},
								})
							}
							onClearTagVote={clearVote}
							onPathJudgment={(pathId, body) =>
								realmPathJudgment.mutate({
									path: {
										realmId: activeVoteContext.realm.realmId,
										unitId,
										pathId,
									},
									body,
								})
							}
							onTagVote={vote}
							onToggleSelected={toggleSelected}
							paths={realmPathApplications}
							renderMeta={(pathId) => {
								const application = realmPathById.get(pathId)?.application;
								if (!application) return null;
								return (
									<p className="text-xs text-muted-foreground">
										{t.tags.realms.pathAuthority({
											fit: t.tags.realms.authority[application.fit.authority],
											spoiler: t.tags.realms.authority[application.spoiler.authority],
										})}
									</p>
								);
							}}
							selectedTagIds={selectedTagIds}
							selectionMode={selectionMode}
							surface="page"
							type={workUnitType}
						/>
						{activeRealmPathsQuery.data?.items
							.filter(({ application }) => !application)
							.map((item) => (
								<div
									className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
									key={item.pathId}
								>
									<span>
										{item.members.map((member) => member.title ?? t.tags.unnamedTag).join(" › ")}
									</span>
									<Button
										isLoading={
											applyRealmPath.isPending &&
											applyRealmPath.variables?.path.pathId === item.pathId
										}
										onClick={() =>
											applyRealmPath.mutate({
												path: {
													realmId: activeVoteContext.realm.realmId,
													unitId,
													pathId: item.pathId,
												},
											})
										}
										size="sm"
									>
										{t.tags.realms.applyPath}
									</Button>
								</div>
							))}
					</>
				)}
			</div>
		) : null;

	return (
		<div className="grid gap-8">
			<div
				className={
					surface === "section"
						? "flex flex-wrap items-center justify-between gap-3"
						: "flex flex-wrap items-center justify-end gap-2"
				}
			>
				{surface === "section" ? (
					<h2 className="font-heading text-lg font-bold sm:text-xl">{t.tags.page.title}</h2>
				) : null}
				{surface === "page" ? (
					<Button asChild variant="outline">
						<Link href="/settings/tag-sources">{t.tags.sources.manage}</Link>
					</Button>
				) : null}
				<Button
					onClick={() => dispatchSelection(selectionMode ? { type: "exit" } : { type: "enter" })}
					variant={selectionMode ? "secondary" : "outline"}
				>
					{selectionMode ? t.tags.selection.finish : t.tags.selection.start}
				</Button>
			</div>

			{surface === "page" ? (
				<>
					<section className="grid gap-5">
						<div className="grid gap-3">
							<div className="grid gap-1">
								<h2 className="font-heading text-xl font-bold">{t.tags.voteContext.title}</h2>
								<p className="max-w-3xl text-sm leading-6 text-muted-foreground">
									{t.tags.voteContext.description}
								</p>
							</div>
							<TagVoteContextSelector
								onValueChange={setVoteContext}
								realms={voteRealms}
								value={activeVoteContext}
							/>
						</div>

						{activeVoteContext.kind === "global" ? (
							<>
								{globalPathSection}
								<TagContextSection
									description={t.tags.global.description}
									empty={t.tags.global.empty}
									fallbackLabel={t.tags.unnamedTag}
									headingLevel="h3"
									highlightedTagId={highlightedTagId}
									items={globalTags}
									onClearVote={clearVote}
									onToggleSelected={toggleSelected}
									onVote={vote}
									pendingItemKey={pendingItemKey}
									selectedTagIds={selectedTagIds}
									selectionMode={selectionMode}
									title={t.tags.global.title}
									type={type}
								/>
							</>
						) : activeRealmTagsQuery.isPending ? (
							<QueryPending />
						) : activeRealmTagsQuery.isError || !activeRealmTagsQuery.data ? (
							<QueryFailure
								error={activeRealmTagsQuery.error}
								retry={() => void activeRealmTagsQuery.refetch()}
							/>
						) : (
							<>
								{realmPathSection}
								<TagContextSection
									description={activeVoteContext.realm.summary}
									descriptionLanguage={
										activeVoteContext.realm.summary ? activeVoteContext.realm.language : null
									}
									empty={t.tags.realms.empty}
									fallbackLabel={t.tags.unnamedTag}
									heading={
										<RealmTagContextHeading
											fallbackTitle={t.tags.unnamedRealm}
											realm={activeVoteContext.realm}
										/>
									}
									headingLevel="h3"
									highlightedTagId={highlightedTagId}
									items={activeTags}
									onClearVote={clearVote}
									onToggleSelected={toggleSelected}
									onVote={vote}
									pendingItemKey={pendingItemKey}
									selectedTagIds={selectedTagIds}
									selectionMode={selectionMode}
									title={activeVoteContext.realm.title ?? t.tags.unnamedRealm}
									titleLanguage={
										activeVoteContext.realm.title ? activeVoteContext.realm.language : null
									}
									type={type}
								/>
							</>
						)}

						<UnitTagManagement
							addError={activeVoteContext.kind === "global" ? add.error : realmVote.error}
							addPending={activeVoteContext.kind === "global" ? add.isPending : realmVote.isPending}
							addPathError={addPath.error}
							addPathPending={addPath.isPending}
							canVote={activeVoteContext.kind === "realm" || Boolean(session)}
							key={
								activeVoteContext.kind === "global"
									? "global"
									: `realm:${activeVoteContext.realm.realmId}`
							}
							tagCreateTarget={{
								type,
								unitId,
								context:
									activeVoteContext.kind === "global"
										? { kind: "global" }
										: {
												kind: "realm",
												realmId: activeVoteContext.realm.realmId,
											},
							}}
							onAddPath={
								workUnitType
									? (pathId) =>
											addPath
												.mutateAsync({
													path: { type: workUnitType, unitId, pathId },
												})
												.then(() => undefined)
									: undefined
							}
							onAddTag={(tagId) =>
								activeVoteContext.kind === "global"
									? add
											.mutateAsync({
												path: { type, unitId, tagId },
												body: {},
											})
											.then(() => undefined)
									: realmVote
											.mutateAsync({
												path: {
													realmId: activeVoteContext.realm.realmId,
													unitId,
													tagId,
												},
												body: { value: 1 },
											})
											.then(() => undefined)
							}
						/>
					</section>

					<section className="grid gap-5 border-t border-border-weak pt-6">
						<div className="grid gap-1">
							<h2 className="font-heading text-xl font-bold">{t.tags.details.title}</h2>
							<p className="max-w-3xl text-sm leading-6 text-muted-foreground">
								{t.tags.details.description}
							</p>
						</div>
						{detailContexts.showGlobal ? (
							<div className="grid gap-5">
								{globalPathSection}
								<TagContextSection
									description={t.tags.global.description}
									empty={t.tags.global.empty}
									fallbackLabel={t.tags.unnamedTag}
									headingLevel="h3"
									items={globalTags}
									onClearVote={clearVote}
									onToggleSelected={toggleSelected}
									onVote={vote}
									pendingItemKey={pendingItemKey}
									selectedTagIds={selectedTagIds}
									selectionMode={selectionMode}
									title={t.tags.global.title}
									type={type}
								/>
							</div>
						) : null}
						{detailContexts.realmGroups.length ? (
							<div className="grid gap-6">
								{detailContexts.realmGroups.map((group) => (
									<TagContextSection
										description={group.summary}
										descriptionLanguage={group.summary ? group.language : null}
										empty={t.tags.realms.empty}
										fallbackLabel={t.tags.unnamedTag}
										heading={
											<RealmTagContextHeading fallbackTitle={t.tags.unnamedRealm} realm={group} />
										}
										headingLevel="h3"
										items={group.tags}
										key={group.realmId}
										onClearVote={clearVote}
										onToggleSelected={toggleSelected}
										onVote={vote}
										pendingItemKey={pendingItemKey}
										selectedTagIds={selectedTagIds}
										selectionMode={selectionMode}
										title={group.title ?? t.tags.unnamedRealm}
										titleLanguage={group.title ? group.language : null}
										type={type}
									/>
								))}
							</div>
						) : detailContexts.showGlobal ? null : (
							<p className="text-sm text-muted-foreground">{t.tags.details.empty}</p>
						)}
					</section>
				</>
			) : (
				<>
					<section className="grid gap-5">
						<h3 className="font-heading text-lg font-bold">{t.tags.basic.title}</h3>
						{globalPathSection}
						<TagContextSection
							empty={t.tags.global.empty}
							fallbackLabel={t.tags.unnamedTag}
							headingLevel={groupHeadingLevel}
							items={globalTags}
							onClearVote={clearVote}
							onToggleSelected={toggleSelected}
							onVote={vote}
							pendingItemKey={pendingItemKey}
							selectedTagIds={selectedTagIds}
							selectionMode={selectionMode}
							title={t.tags.global.title}
							type={type}
						/>
						{compactHiddenCount > 0 ? (
							<Button asChild className="w-fit" size="sm" variant="quiet">
								<Link href={unitTagsHref(type, unitId)}>
									{t.tags.page.more({ count: compactHiddenCount })}
								</Link>
							</Button>
						) : null}
					</section>

					{realmGroups.length ? (
						<section className="grid gap-5 border-t border-border-weak pt-6">
							<h3 className="font-heading text-lg font-bold">{t.tags.realms.title}</h3>
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
										headingLevel={groupHeadingLevel}
										items={group.tags}
										key={group.realmId}
										onClearVote={clearVote}
										onToggleSelected={toggleSelected}
										onVote={vote}
										pendingItemKey={pendingItemKey}
										selectedTagIds={selectedTagIds}
										selectionMode={selectionMode}
										title={group.title ?? t.tags.unnamedRealm}
										titleLanguage={group.title ? group.language : null}
										type={type}
									/>
								))}
							</div>
						</section>
					) : null}
				</>
			)}

			<RequestFailure
				error={
					pathJudgment.error ??
					clearPathJudgment.error ??
					applyRealmPath.error ??
					realmPathJudgment.error ??
					clearRealmPathJudgment.error ??
					globalVote.error ??
					clearGlobalVote.error ??
					realmVote.error ??
					clearRealmVote.error
				}
				fallback={t.ui.retryLater}
			/>

			{surface === "section" ? (
				<Button asChild className="w-fit" variant="outline">
					<Link href={unitTagsHref(type, unitId)}>{t.tags.page.viewAll}</Link>
				</Button>
			) : null}

			{selectionMode ? (
				<TagSelectionToolbar
					identities={identities}
					labels={selectionLabels.current}
					onClear={() => dispatchSelection({ type: "clear" })}
					onFinish={() => dispatchSelection({ type: "exit" })}
					selectedTagIds={selection.selectedTagIds}
					type={type}
				/>
			) : null}
		</div>
	);
}

function voteOnTarget(
	target: TagVoteTarget,
	value: -1 | 1,
	mutations: {
		readonly globalVote: ReturnType<typeof usePutApiUnitsByTypeByUnitIdTagsByTagIdVote>;
		readonly realmVote: ReturnType<typeof usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote>;
	},
) {
	if (target.kind === "global") {
		mutations.globalVote.mutate({
			path: {
				type: target.type,
				unitId: target.unitId,
				tagId: target.tagId,
			},
			body: { value },
		});
		return;
	}
	mutations.realmVote.mutate({
		path: {
			realmId: target.realmId,
			unitId: target.unitId,
			tagId: target.tagId,
		},
		body: { value },
	});
}

function clearVoteOnTarget(
	target: TagVoteTarget,
	mutations: {
		readonly clearGlobalVote: ReturnType<typeof useDeleteApiUnitsByTypeByUnitIdTagsByTagIdVote>;
		readonly clearRealmVote: ReturnType<
			typeof useDeleteApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote
		>;
	},
) {
	if (target.kind === "global") {
		mutations.clearGlobalVote.mutate({
			path: {
				type: target.type,
				unitId: target.unitId,
				tagId: target.tagId,
			},
		});
		return;
	}
	mutations.clearRealmVote.mutate({
		path: {
			realmId: target.realmId,
			unitId: target.unitId,
			tagId: target.tagId,
		},
	});
}

function pendingTagItemKey(input: {
	readonly globalVote: ReturnType<typeof usePutApiUnitsByTypeByUnitIdTagsByTagIdVote>;
	readonly clearGlobalVote: ReturnType<typeof useDeleteApiUnitsByTypeByUnitIdTagsByTagIdVote>;
	readonly realmVote: ReturnType<typeof usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote>;
	readonly clearRealmVote: ReturnType<
		typeof useDeleteApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote
	>;
}): string | undefined {
	if (input.globalVote.isPending && input.globalVote.variables)
		return `global:${input.globalVote.variables.path.tagId}`;
	if (input.clearGlobalVote.isPending && input.clearGlobalVote.variables)
		return `global:${input.clearGlobalVote.variables.path.tagId}`;
	if (input.realmVote.isPending && input.realmVote.variables)
		return `realm:${input.realmVote.variables.path.realmId}:${input.realmVote.variables.path.tagId}`;
	if (input.clearRealmVote.isPending && input.clearRealmVote.variables)
		return `realm:${input.clearRealmVote.variables.path.realmId}:${input.clearRealmVote.variables.path.tagId}`;
	return undefined;
}
