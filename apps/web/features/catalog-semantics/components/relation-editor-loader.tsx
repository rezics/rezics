"use client";
import { useQuery } from "@tanstack/react-query";
import type { CatalogReference } from "@rezics/reference";
import {
	useGetCatalogDefinitionRevision,
	listCatalogRelationParticipants,
	listCatalogRelationQualifiers,
	type ListCatalogRelationsStatus200,
} from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RelationEditor } from "./relation-editor";
import type { ParticipantDraft, QualifierDraft } from "../model/semantic-draft";
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
		queryFn: async () => {
			const participants: ParticipantDraft[] = [],
				qualifiers: QualifierDraft[] = [];
			let afterPosition = -1,
				afterId: string | undefined;
			for (let page = 0; page < 3; page++) {
				const { data } = await listCatalogRelationParticipants({
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
					path: { ...reference, relationId: relation.id },
					query: { limit: 32, afterId, maxSpoiler: relation.spoiler },
				});
				qualifiers.push(
					...data.items.map((item) => ({
						definitionRevisionId: item.definitionRevisionId,
						valueFactId: item.valueFactId,
					})),
				);
				if (qualifiers.length > 64) return null;
				if (data.afterId === null) break;
				if (page === 2 || data.afterId === afterId) return null;
				afterId = data.afterId;
			}
			return { participants, qualifiers };
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
