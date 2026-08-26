"use client";

import { getApiTagsSuggestions } from "@rezics/openapi-tanstack-query";
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
	readonly kind?: string;
}

export function UnitTagManagement({
	addError,
	addPending,
	addPathError,
	addPathPending,
	canVote,
	tagCreateTarget,
	onAddPath,
	onAddTag,
}: {
	readonly addError: unknown;
	readonly addPending: boolean;
	readonly addPathError: unknown;
	readonly addPathPending: boolean;
	readonly canVote: boolean;
	readonly tagCreateTarget: UnitTagVoteCreateTarget;
	readonly onAddPath?: (pathId: string) => Promise<void>;
	readonly onAddTag: (tagId: string) => Promise<void>;
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const searchEntities = useEntitySearch();
	const [selectedTag, setSelectedTag] = useState<PickedEntity>();
	const contextKind = tagCreateTarget.context.kind;
	const contextRealmId =
		tagCreateTarget.context.kind === "realm" ? tagCreateTarget.context.realmId : undefined;
	const tagSearch = useMemo<EntitySearch | undefined>(
		() =>
			searchEntities
				? async (index, query, signal, options) => {
						if (!contextRealmId && onAddPath) {
							const response = await getApiTagsSuggestions({
								query: { q: query, limit: 20 },
								signal,
								throwOnError: true,
							});
							return response.data.items.map((item) => ({
								id: item.selection === "path" ? `path:${item.pathId}` : item.tagId,
								label:
									item.selection === "path"
										? item.members.map((member) => member.title ?? t.tags.unnamedTag).join(" › ")
										: (item.title ?? t.tags.unnamedTag),
								kind: item.selection === "path" ? "tag-path" : "tag",
								avatar: item.avatar,
							}));
						}
						return searchEntities(index, query, signal, {
							...options,
							...(contextRealmId ? { realmTagContextRealmId: contextRealmId } : {}),
						});
					}
				: undefined,
		[contextRealmId, onAddPath, searchEntities, t.tags.unnamedTag],
	);
	if (!canVote) return null;
	const addCopy = contextKind === "global" ? t.tags.global : t.tags.realms;
	return (
		<div className="grid gap-6">
			<div className="grid gap-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="grid gap-1">
						<h2 className="font-semibold">{addCopy.addTitle}</h2>
						<p className="text-sm text-muted-foreground">{addCopy.addDescription}</p>
					</div>
					{tagCreateTarget.context.kind === "global" ? (
						<div className="flex flex-wrap gap-2">
							<Button asChild variant="outline">
								<Link href="/tag-paths/new">{t.tags.paths.create}</Link>
							</Button>
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
						</div>
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
						value={selectedTag}
					/>
					<Button
						disabled={!selectedTag}
						isLoading={addPending || addPathPending}
						onClick={() => {
							if (!selectedTag) return;
							const pathId = selectedTag.id.startsWith("path:")
								? selectedTag.id.slice("path:".length)
								: undefined;
							const operation = pathId && onAddPath ? onAddPath(pathId) : onAddTag(selectedTag.id);
							void operation.then(() => setSelectedTag(undefined)).catch(() => undefined);
						}}
					>
						{addCopy.add}
					</Button>
				</div>
				<RequestFailure error={addError} fallback={t.ui.retryLater} />
				<RequestFailure error={addPathError} fallback={t.ui.retryLater} />
			</div>
		</div>
	);
}
