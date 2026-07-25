"use client";

import { toContentLanguage } from "@rezics/i18n";
import {
	getApiUnitsByTypeByUnitIdTagsQueryKey,
	useDeleteApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote,
	useDeleteApiUnitsByTypeByUnitIdTagStructuresByStructureIdVote,
	useDeleteApiUnitsByTypeByUnitIdTagsByTagIdVote,
	useGetApiUnitsByTypeByUnitIdTags,
	usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote,
	usePutApiUnitsByTypeByUnitIdTagStructuresByStructureId,
	usePutApiUnitsByTypeByUnitIdTagStructuresByStructureIdVote,
	usePutApiUnitsByTypeByUnitIdTagsByTagId,
	usePutApiUnitsByTypeByUnitIdTagsByTagIdVote,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useReducer } from "react";

import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { presentGlobalTags, presentRealmTagGroups } from "../data/unit-tag-presentation";
import type { TagIdentity, TagPresentation, TagVoteTarget } from "../model/tag-presentation";
import { InitialTagSelectionState, tagSelectionReducer } from "../model/tag-selection";
import { unitTagsHref } from "../routing/tag-links";
import { TagContextSection } from "./tag-context-section";
import { TagSelectionToolbar } from "./tag-selection-toolbar";
import { presentStructureMembers, TagStructureList } from "./tag-structure-list";
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

export function UnitTagExplorer({
	surface,
	type,
	unitId,
}: {
	readonly surface: "section" | "page";
	readonly type: CatalogDetailUnitType;
	readonly unitId: string;
}) {
	const { data: session } = useHydratedSession();
	const { locale, t } = useTranslation(["tags", "ui"]);
	const queryClient = useQueryClient();
	const [selection, dispatchSelection] = useReducer(
		tagSelectionReducer,
		InitialTagSelectionState,
	);
	const queryInput = {
		path: { type, unitId },
		query: {
			language: toContentLanguage(locale.target),
			...SurfaceLimits[surface],
		},
	} as const;
	const query = useGetApiUnitsByTypeByUnitIdTags(queryInput);
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: getApiUnitsByTypeByUnitIdTagsQueryKey({
				path: queryInput.path,
			}),
		});
	const add = usePutApiUnitsByTypeByUnitIdTagsByTagId({
		mutation: { onSuccess: invalidate },
	});
	const addStructure = usePutApiUnitsByTypeByUnitIdTagStructuresByStructureId({
		mutation: { onSuccess: invalidate },
	});
	const structureVote = usePutApiUnitsByTypeByUnitIdTagStructuresByStructureIdVote({
		mutation: { onSuccess: invalidate },
	});
	const clearStructureVote = useDeleteApiUnitsByTypeByUnitIdTagStructuresByStructureIdVote({
		mutation: { onSuccess: invalidate },
	});
	const globalVote = usePutApiUnitsByTypeByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: invalidate },
	});
	const clearGlobalVote = useDeleteApiUnitsByTypeByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: invalidate },
	});
	const realmVote = usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: invalidate },
	});
	const clearRealmVote = useDeleteApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote({
		mutation: { onSuccess: invalidate },
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
	const identities = new Map<string, TagIdentity>();
	for (const item of globalTags) identities.set(item.identity.tagId, item.identity);
	for (const structure of query.data.structures)
		for (const item of presentStructureMembers(structure))
			identities.set(item.identity.tagId, item.identity);
	for (const group of realmGroups)
		for (const item of group.tags) identities.set(item.identity.tagId, item.identity);
	const selectedTagIds = new Set(selection.selectedTagIds);
	const selectionMode = selection.mode === "selecting";
	const pendingItemKey = pendingTagItemKey({
		globalVote,
		clearGlobalVote,
		realmVote,
		clearRealmVote,
	});
	const toggleSelected = (tagId: string) =>
		dispatchSelection(selectionMode ? { type: "toggle", tagId } : { type: "enter", tagId });
	const vote = (item: TagPresentation, value: -1 | 1) => {
		if (item.vote.kind !== "available" || !item.vote.canVote) return;
		voteOnTarget(item.vote.target, value, { globalVote, realmVote });
	};
	const clearVote = (item: TagPresentation) => {
		if (item.vote.kind !== "available" || !item.vote.canVote) return;
		clearVoteOnTarget(item.vote.target, { clearGlobalVote, clearRealmVote });
	};
	const groupHeadingLevel = surface === "page" ? "h3" : "h4";

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
					<h2 className="font-heading text-lg font-bold sm:text-xl">
						{t.tags.page.title}
					</h2>
				) : null}
				{surface === "page" ? (
					<Button asChild variant="outline">
						<Link href="/settings/tag-sources">{t.tags.sources.manage}</Link>
					</Button>
				) : null}
				<Button
					onClick={() =>
						dispatchSelection(selectionMode ? { type: "exit" } : { type: "enter" })
					}
					variant={selectionMode ? "secondary" : "outline"}
				>
					{selectionMode ? t.tags.selection.finish : t.tags.selection.start}
				</Button>
			</div>

			{surface === "page" ? (
				<UnitTagManagement
					addError={add.error}
					addPending={add.isPending}
					addStructureError={addStructure.error}
					addStructurePending={addStructure.isPending}
					onAddStructure={(structureId) =>
						addStructure
							.mutateAsync({
								path: { type, unitId, structureId },
							})
							.then(() => undefined)
					}
					onAddTag={(tagId) =>
						add
							.mutateAsync({
								path: { type, unitId, tagId },
								body: {},
							})
							.then(() => undefined)
					}
					signedIn={Boolean(session)}
				/>
			) : null}

			<section className="grid gap-5">
				{surface === "page" ? (
					<h2 className="font-heading text-xl font-bold">{t.tags.basic.title}</h2>
				) : (
					<h3 className="font-heading text-lg font-bold">{t.tags.basic.title}</h3>
				)}
				{surface === "page" ? (
					<p className="-mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
						{t.tags.basic.description}
					</p>
				) : null}
				{query.data.structures.length ? (
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
									path: { type, unitId, structureId },
								})
							}
							onClearTagVote={clearVote}
							onStructureVote={(structureId, value) =>
								structureVote.mutate({
									path: { type, unitId, structureId },
									body: { value },
								})
							}
							onTagVote={vote}
							onToggleSelected={toggleSelected}
							selectedTagIds={selectedTagIds}
							selectionMode={selectionMode}
							structures={query.data.structures}
							surface={surface}
							type={type}
						/>
					</div>
				) : null}
				<TagContextSection
					description={surface === "page" ? t.tags.global.description : undefined}
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

			{surface === "page" || realmGroups.length ? (
				<section className="grid gap-5 border-t border-border-weak pt-6">
					<div className="grid gap-1">
						{surface === "page" ? (
							<h2 className="font-heading text-xl font-bold">
								{t.tags.realms.title}
							</h2>
						) : (
							<h3 className="font-heading text-lg font-bold">
								{t.tags.realms.title}
							</h3>
						)}
						{surface === "page" ? (
							<p className="max-w-3xl text-sm leading-6 text-muted-foreground">
								{t.tags.realms.description}
							</p>
						) : null}
					</div>
					{realmGroups.length ? (
						<div className="grid gap-6">
							{realmGroups.map((group) => (
								<TagContextSection
									description={group.summary}
									empty={t.tags.realms.empty}
									fallbackLabel={t.tags.unnamedTag}
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
									type={type}
								/>
							))}
						</div>
					) : (
						<p className="text-sm text-muted-foreground">{t.tags.realms.empty}</p>
					)}
				</section>
			) : null}

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
