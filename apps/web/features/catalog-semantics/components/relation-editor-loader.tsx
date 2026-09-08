"use client";
import { useQuery } from "@tanstack/react-query";
import type { CatalogReference } from "@rezics/reference";
import {
	useGetCatalogDefinitionRevision,
	getCatalogDefinitionRevision,
	listCatalogFactNodes,
	listCatalogRelationParticipants,
	listCatalogRelationQualifiers,
	type ListCatalogRelationsStatus200,
} from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RelationEditor } from "./relation-editor";
import {
	valueDraftFromNodes,
	type ParticipantDraft,
	type QualifierDraft,
	type ReadValueNode,
} from "../model/semantic-draft";
export type RelationSummary = ListCatalogRelationsStatus200["items"][number];
export function RelationEditorLoader({
	reference,
	revision,
	relation,
	onSaved,
}: {
	reference: CatalogReference;
	revision: number;
	relation: RelationSummary;
	onSaved: () => void;
}) {
	const { t, locale } = useTranslation(["units"]),
		definition = useGetCatalogDefinitionRevision({ path: { id: relation.definitionRevisionId } });
	const values = useQuery({
		queryKey: ["catalog-relation-edit", reference.owner, reference.id, relation.id, locale.target],
		queryFn: async ({ signal }) => {
			const participants: ParticipantDraft[] = [],
				qualifiers: NonNullable<
					Awaited<ReturnType<typeof listCatalogRelationQualifiers>>["data"]
				>["items"] = [];
			let afterPosition = -1,
				afterId: string | undefined;
			for (let page = 0; page < 3; page++) {
				const { data } = await listCatalogRelationParticipants({
					signal,
					throwOnError: true,
					path: { ...reference, relationId: relation.id },
					query: {
						limit: 64,
						afterPosition,
						maxSpoiler: relation.spoiler,
						languageTag: locale.target,
					},
				});
				for (const item of data.items)
					participants.push({
						roleRevisionId: item.roleRevisionId,
						creditedAs: item.creditedAs ?? "",
						...(item.targetPreview
							? {
									target: {
										reference: item.target,
										shape: item.targetPreview.shape,
										label: item.targetPreview.title ?? t.units.nativeSemantics.unnamedTarget,
									},
								}
							: {}),
					});
				if (participants.length > 128) return null;
				if (data.afterPosition === null) break;
				if (page === 2 || data.afterPosition <= afterPosition) return null;
				afterPosition = data.afterPosition;
			}
			for (let page = 0; page < 3; page++) {
				const { data } = await listCatalogRelationQualifiers({
					signal,
					throwOnError: true,
					path: { ...reference, relationId: relation.id },
					query: { limit: 32, afterId, maxSpoiler: relation.spoiler },
				});
				qualifiers.push(...data.items);
				if (qualifiers.length > 64) return null;
				if (data.afterId === null) break;
				if (page === 2 || data.afterId === afterId) return null;
				afterId = data.afterId;
			}
			const drafts: (QualifierDraft | null)[] = new Array(qualifiers.length).fill(null);
			let nextIndex = 0,
				totalNodes = 0,
				totalBytes = 0,
				tooLarge = false;
			await Promise.all(
				Array.from({ length: Math.min(4, qualifiers.length) }, async () => {
					while (nextIndex < qualifiers.length && !tooLarge) {
						const index = nextIndex++,
							qualifier = qualifiers[index];
						if (!qualifier) return;
						if (qualifier.valueFactPurpose === "assertion") {
							drafts[index] = {
								definitionRevisionId: qualifier.definitionRevisionId,
								valueFactId: qualifier.valueFactId,
							};
							continue;
						}
						const exactDefinition = getCatalogDefinitionRevision({
							path: { id: qualifier.definitionRevisionId },
							signal,
							throwOnError: true,
						});
						const nodePages = async () => {
							const nodes: ReadValueNode[] = [];
							let afterPosition = -1;
							for (let page = 0; page < 5 && !tooLarge; page++) {
								const { data } = await listCatalogFactNodes({
									path: { ...reference, factId: qualifier.valueFactId },
									query: {
										relationId: relation.id,
										afterPosition,
										limit: 128,
										maxSpoiler: relation.spoiler,
									},
									signal,
									throwOnError: true,
								});
								totalNodes += data.items.length;
								totalBytes += new TextEncoder().encode(
									JSON.stringify(
										data.items.map(({ rulePosition: _rulePosition, ...node }) => node),
									),
								).byteLength;
								if (totalNodes > 512 || totalBytes > 512_000) {
									tooLarge = true;
									return null;
								}
								nodes.push(...data.items);
								if (data.afterPosition === null) return nodes;
								if (data.afterPosition <= afterPosition) return null;
								afterPosition = data.afterPosition;
							}
							return null;
						};
						const [{ data: qualifierDefinition }, nodes] = await Promise.all([
							exactDefinition,
							nodePages(),
						]);
						const value = nodes ? valueDraftFromNodes(qualifierDefinition, nodes) : null;
						if (!value) {
							tooLarge = true;
							return;
						}
						drafts[index] = {
							definitionRevisionId: qualifier.definitionRevisionId,
							definition: qualifierDefinition,
							nodes: value,
						};
					}
				}),
			);
			if (tooLarge || drafts.some((value) => value === null)) return null;
			return {
				participants,
				qualifiers: drafts.filter((value): value is QualifierDraft => value !== null),
			};
		},
	});
	if (definition.isPending || values.isPending) return <QueryPending />;
	if (definition.isError)
		return <QueryFailure error={definition.error} retry={() => void definition.refetch()} />;
	if (values.isError)
		return <QueryFailure error={values.error} retry={() => void values.refetch()} />;
	return values.data ? (
		<RelationEditor
			reference={reference}
			revision={revision}
			initial={{
				definition: definition.data,
				...values.data,
				spoiler: relation.spoiler,
				replaces: { semanticId: relation.semanticId, headVersion: relation.headVersion },
			}}
			onSaved={onSaved}
		/>
	) : (
		<p>{t.units.nativeSemantics.largeEdit}</p>
	);
}
