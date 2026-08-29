"use client";

import { getApiTagsSuggestions } from "@rezics/openapi-tanstack-query";
import { Button, EntityPicker, useEntitySearch, type EntitySearch } from "@rezics/ui";
import { Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";

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
	canVote,
	tagCreateTarget,
	onAddSelection,
}: {
	readonly addError: unknown;
	readonly addPending: boolean;
	readonly canVote: boolean;
	readonly tagCreateTarget: UnitTagVoteCreateTarget;
	readonly onAddSelection: (selection: {
		readonly kind: "direct_expression" | "path_sense";
		readonly tagId: string;
		readonly senseId: string | null;
	}) => Promise<void>;
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const searchEntities = useEntitySearch();
	const [selectedTag, setSelectedTag] = useState<PickedEntity>();
	const selectionById = useRef(
		new Map<
			string,
			{
				readonly kind: "direct_expression" | "path_sense";
				readonly tagId: string;
				readonly senseId: string | null;
			}
		>(),
	);
	const contextKind = tagCreateTarget.context.kind;
	const contextRealmId =
		tagCreateTarget.context.kind === "realm" ? tagCreateTarget.context.realmId : undefined;
	const tagSearch = useMemo<EntitySearch | undefined>(
		() =>
			searchEntities
				? async (_index, query, signal, _options) => {
						const response = await getApiTagsSuggestions({
							query: {
								q: query,
								limit: 20,
								...(contextRealmId ? { realmId: contextRealmId } : {}),
							},
							signal,
							throwOnError: true,
						});
						return response.data.items.flatMap((item) => {
							const senseId = item.senseId ?? null;
							if (item.selection === "path_sense" && !senseId) return [];
							const id =
								item.selection === "path_sense"
									? `sense:${senseId}`
									: `expression:${item.expression.expressionId}`;
							selectionById.current.set(id, {
								kind: item.selection,
								tagId: item.expression.focusTagId,
								senseId,
							});
							const semanticLabel = item.expression.components
								.filter(({ componentKind }) => componentKind === "required")
								.map(({ title }) => title ?? t.tags.unnamedTag)
								.join(" · ");
							const pathLabel = item.members
								.map(({ title }) => title ?? t.tags.paths.memberFallback)
								.join(" › ");
							return [
								{
									id,
									label: pathLabel ? `${semanticLabel} — ${pathLabel}` : semanticLabel,
									kind:
										item.selection === "path_sense"
											? t.tags.expressions.pathApplication
											: t.tags.expressions.directApplication,
								},
							];
						});
					}
				: undefined,
		[
			contextRealmId,
			searchEntities,
			t.tags.expressions.directApplication,
			t.tags.expressions.pathApplication,
			t.tags.paths.memberFallback,
			t.tags.unnamedTag,
		],
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
						searchOnOpen={Boolean(contextRealmId)}
						value={selectedTag}
					/>
					<Button
						disabled={!selectedTag}
						isLoading={addPending}
						onClick={() => {
							if (!selectedTag) return;
							const selection = selectionById.current.get(selectedTag.id);
							if (!selection) return;
							const operation = onAddSelection(selection);
							void operation.then(() => setSelectedTag(undefined)).catch(() => undefined);
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
