"use client";

import { Button, EntityPicker, useEntitySearch, type EntitySearch } from "@rezics/ui";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { unitTagVoteCreateHref, type UnitTagVoteCreateTarget } from "../routing/tag-create-route";

interface PickedEntity {
	readonly id: string;
	readonly label: string;
}

export function UnitTagManagement({
	addError,
	addPending,
	addStructureError,
	addStructurePending,
	canVote,
	hasDevelopmentPreviewAccess,
	tagCreateTarget,
	onAddStructure,
	onAddTag,
}: {
	readonly addError: unknown;
	readonly addPending: boolean;
	readonly addStructureError: unknown;
	readonly addStructurePending: boolean;
	readonly canVote: boolean;
	readonly hasDevelopmentPreviewAccess: boolean;
	readonly tagCreateTarget: UnitTagVoteCreateTarget;
	readonly onAddStructure: (structureId: string) => Promise<void>;
	readonly onAddTag: (tagId: string) => Promise<void>;
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const searchEntities = useEntitySearch();
	const [selectedTag, setSelectedTag] = useState<PickedEntity>();
	const [selectedStructure, setSelectedStructure] = useState<PickedEntity>();
	const contextKind = tagCreateTarget.context.kind;
	const contextRealmId =
		tagCreateTarget.context.kind === "realm" ? tagCreateTarget.context.realmId : undefined;
	const tagSearch = useMemo<EntitySearch | undefined>(
		() =>
			contextRealmId && searchEntities
				? (index, query, signal, options) =>
						searchEntities(index, query, signal, {
							...options,
							realmTagContextRealmId: contextRealmId,
						})
				: undefined,
		[contextRealmId, searchEntities],
	);
	if (!canVote) return null;
	const showStructureManagement = contextKind === "global" && hasDevelopmentPreviewAccess;
	const addCopy = contextKind === "global" ? t.tags.global : t.tags.realms;
	return (
		<div className="grid gap-6">
			{showStructureManagement ? (
				<div className="grid gap-3">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="grid gap-1">
							<h2 className="font-semibold">{t.tags.structures.addTitle}</h2>
							<p className="text-sm text-muted-foreground">
								{t.tags.structures.addDescription}
							</p>
						</div>
						<Button asChild variant="outline">
							<Link href="/tag-structures/new">{t.tags.structures.create}</Link>
						</Button>
					</div>
					<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
						<EntityPicker
							ariaLabel={t.tags.structures.addTitle}
							index="tag-structures"
							onChange={setSelectedStructure}
							placeholder={t.ui.pickerPlaceholders.tagStructure}
							value={selectedStructure}
						/>
						<Button
							disabled={!selectedStructure}
							isLoading={addStructurePending}
							onClick={() => {
								if (!selectedStructure) return;
								void onAddStructure(selectedStructure.id)
									.then(() => setSelectedStructure(undefined))
									.catch(() => undefined);
							}}
						>
							{t.tags.structures.add}
						</Button>
					</div>
					<RequestFailure error={addStructureError} fallback={t.ui.retryLater} />
				</div>
			) : null}
			<div
				className={
					showStructureManagement
						? "grid gap-3 border-t border-border-weak pt-6"
						: "grid gap-3"
				}
			>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="grid gap-1">
						<h2 className="font-semibold">{addCopy.addTitle}</h2>
						<p className="text-sm text-muted-foreground">{addCopy.addDescription}</p>
					</div>
					{tagCreateTarget.context.kind === "global" ? (
						<Button asChild variant="outline">
							<Link
								href={unitTagVoteCreateHref("", {
									type: tagCreateTarget.type,
									unitId: tagCreateTarget.unitId,
									context: { kind: "global" },
								})}
							>
								<Plus aria-hidden className="size-4" />
								{t.tags.create.title}
							</Link>
						</Button>
					) : null}
				</div>
				<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
					<EntityPicker
						ariaLabel={addCopy.addTitle}
						index="tags"
						maxLength={500}
						onChange={setSelectedTag}
						placeholder={t.ui.pickerPlaceholders.tag}
						search={tagSearch}
						searchOnOpen={tagSearch !== undefined}
						value={selectedTag}
					/>
					<Button
						disabled={!selectedTag}
						isLoading={addPending}
						onClick={() => {
							if (!selectedTag) return;
							void onAddTag(selectedTag.id)
								.then(() => setSelectedTag(undefined))
								.catch(() => undefined);
						}}
					>
						{addCopy.add}
					</Button>
				</div>
				<RequestFailure error={addError} fallback={t.ui.retryLater} />
			</div>
		</div>
	);
}
