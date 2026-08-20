"use client";

import {
	getApiRealmsByRealmIdUnitsByUnitIdTagsQueryKey,
	getApiUnitsByTypeByUnitIdTagsQueryKey,
	useDeleteApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote,
	useDeleteApiUnitsByTypeByUnitIdTagStructuresByStructureIdVote,
	useDeleteApiUnitsByTypeByUnitIdTagsByTagIdVote,
	useGetApiRealmsByRealmIdUnitsByUnitIdTags,
	useGetApiUnitsByTypeByUnitIdTags,
	usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote,
	usePutApiUnitsByTypeByUnitIdTagStructuresByStructureId,
	usePutApiUnitsByTypeByUnitIdTagStructuresByStructureIdVote,
	usePutApiUnitsByTypeByUnitIdTagsByTagId,
	usePutApiUnitsByTypeByUnitIdTagsByTagIdVote,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useReducer, useRef, useState } from "react";

import type { UnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { useDevelopmentPreviewAccess } from "@/features/preview-access/components/development-preview-boundary";
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
import { presentStructureMembers, TagStructureList } from "./tag-structure-list";
import { TagVoteContextSelector } from "./tag-vote-context-selector";
import { UnitTagManagement } from "./unit-tag-management";

const SurfaceLimits = {
	section: {
		globalLimit: 8,
		structureLimit: 4,
		sourceLimit: 3,
		perRealmLimit: 4,
	},
	page: {
		globalLimit: 100,
		structureLimit: 50,
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
	const developmentPreview = useDevelopmentPreviewAccess();
	const hasDevelopmentPreviewAccess = developmentPreview.state === "allowed";
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
	const add = usePutApiUnitsByTypeByUnitIdTagsByTagId({
		mutation: { onSuccess: invalidateLandscape },
	});
	const addStructure = usePutApiUnitsByTypeByUnitIdTagStructuresByStructureId({
		mutation: { onSuccess: invalidateLandscape },
	});
	const structureVote = usePutApiUnitsByTypeByUnitIdTagStructuresByStructureIdVote({
		mutation: { onSuccess: invalidateLandscape },
	});
	const clearStructureVote = useDeleteApiUnitsByTypeByUnitIdTagStructuresByStructureIdVote({
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

	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	const globalTags = presentGlobalTags({
		data: query.data,
		type,
		unitId,
		signedIn: Boolean(session),
	});
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
	if (hasDevelopmentPreviewAccess && workUnitType)
		for (const structure of query.data.structures)
			for (const item of presentStructureMembers(structure))
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
	const globalStructureSection =
		workUnitType && hasDevelopmentPreviewAccess && query.data.structures.length ? (
			<div className="grid gap-3">
				{surface === "page" ? (
					<h3 className="font-semibold">{t.tags.structures.title}</h3>
				) : (
					<h4 className="font-semibold">{t.tags.structures.title}</h4>
				)}
				<TagStructureList
					canVote={Boolean(session)}
					isPending={(structureId) =>
						(structureVote.isPending &&
							structureVote.variables?.path.structureId === structureId) ||
						(clearStructureVote.isPending &&
							clearStructureVote.variables?.path.structureId === structureId)
					}
					onClearStructureVote={(structureId) =>
						clearStructureVote.mutate({
							path: { type: workUnitType, unitId, structureId },
						})
					}
					onClearTagVote={clearVote}
					onStructureVote={(structureId, value) =>
						structureVote.mutate({
							path: { type: workUnitType, unitId, structureId },
							body: { value },
						})
					}
					onTagVote={vote}
					onToggleSelected={toggleSelected}
					selectedTagIds={selectedTagIds}
					selectionMode={selectionMode}
					structures={query.data.structures}
					surface={surface}
					type={workUnitType}
				/>
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
								{globalStructureSection}
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
						)}

						<UnitTagManagement
							addError={activeVoteContext.kind === "global" ? add.error : realmVote.error}
							addPending={activeVoteContext.kind === "global" ? add.isPending : realmVote.isPending}
							addStructureError={addStructure.error}
							addStructurePending={addStructure.isPending}
							canVote={activeVoteContext.kind === "realm" || Boolean(session)}
							hasDevelopmentPreviewAccess={hasDevelopmentPreviewAccess && workUnitType !== null}
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
							onAddStructure={
								workUnitType
									? (structureId) =>
											addStructure
												.mutateAsync({
													path: { type: workUnitType, unitId, structureId },
													body: {},
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
								{globalStructureSection}
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
						{globalStructureSection}
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
					structureVote.error ??
					clearStructureVote.error ??
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
