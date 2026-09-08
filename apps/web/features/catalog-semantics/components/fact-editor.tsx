"use client";
import { useState } from "react";
import type { CatalogReference } from "@rezics/reference";
import {
	useWriteCatalogFact,
	useGetCatalogDefinitionRevision,
	listCatalogFactNodes,
	type ListCatalogFactsStatus200,
} from "@rezics/openapi-tanstack-query";
import { useQuery } from "@tanstack/react-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { DefinitionSelect } from "@/features/catalog-definitions/components/definition-select";
import { DefinitionChoice } from "@/features/catalog-definitions/components/definition-fields";
import type {
	DefinitionSelection,
	DefinitionRevision,
} from "@/features/catalog-definitions/model/definition-draft";
import { ValueEditor } from "./value-editor";
import { ExactDefinitionName } from "./definition-revision-options";
import {
	buildFactBody,
	initialValueDraft,
	valueDraftFromNodes,
	type ValueDraftNode,
	type ReadValueNode,
	type Replacement,
} from "../model/semantic-draft";
export type FactSummary = ListCatalogFactsStatus200["items"][number];
export function FactEditor({
	reference,
	revision,
	initial,
	onSaved,
}: {
	reference: CatalogReference;
	revision: number;
	initial?: {
		definition: DefinitionRevision;
		nodes: ValueDraftNode[];
		spoiler: 0 | 1 | 2;
		replaces: Replacement;
	};
	onSaved: () => void;
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeSemantics;
	const [selection, setSelection] = useState<DefinitionSelection>(),
		[rows, setRows] = useState<ValueDraftNode[]>(initial?.nodes ?? []),
		[spoiler, setSpoiler] = useState<0 | 1 | 2>(initial?.spoiler ?? 0),
		[invalid, setInvalid] = useState(false);
	const definition = initial?.definition ?? selection?.revision,
		mutation = useWriteCatalogFact();
	return (
		<form
			className="grid gap-4 rounded-xl border p-4"
			onSubmit={(event) => {
				event.preventDefault();
				if (mutation.isPending || !definition) return;
				const body = buildFactBody(definition, rows, revision, spoiler, initial?.replaces);
				if (!body) {
					setInvalid(true);
					return;
				}
				setInvalid(false);
				void mutation
					.mutateAsync({ path: reference, body })
					.then(onSaved)
					.catch(() => undefined);
			}}
		>
			{initial ? (
				<ExactDefinitionName id={initial.definition.id} />
			) : (
				<DefinitionSelect
					label={copy.property}
					kind="property"
					value={selection}
					onChange={(value) => {
						setSelection(value);
						setRows(value ? initialValueDraft(value.revision) : []);
					}}
				/>
			)}
			<DefinitionChoice
				label={copy.spoiler}
				value={String(spoiler)}
				values={["0", "1", "2"]}
				labelFor={(value) =>
					value === "0" ? copy.spoilerNone : value === "1" ? copy.spoilerMinor : copy.spoilerMajor
				}
				onChange={(value) => setSpoiler(value === "0" ? 0 : value === "1" ? 1 : 2)}
			/>
			{definition ? <ValueEditor definition={definition} rows={rows} onChange={setRows} /> : null}
			{invalid ? <p role="alert">{copy.invalid}</p> : null}
			{mutation.error ? <RequestFailure error={mutation.error} /> : null}
			<Button type="submit" disabled={mutation.isPending || !definition}>
				{copy.saveFact}
			</Button>
		</form>
	);
}
export function FactEditorLoader({
	reference,
	revision,
	fact,
	onSaved,
}: {
	reference: CatalogReference;
	revision: number;
	fact: FactSummary;
	onSaved: () => void;
}) {
	const { t } = useTranslation(["units"]),
		definition = useGetCatalogDefinitionRevision({ path: { id: fact.definitionRevisionId } });
	const nodes = useQuery({
		queryKey: ["catalog-fact-edit", reference.owner, reference.id, fact.id, fact.lastNodePosition],
		enabled: fact.lastNodePosition < 512,
		queryFn: async ({ signal }) => {
			const result: ReadValueNode[] = [];
			let afterPosition = -1;
			for (let page = 0; page < 4; page++) {
				const { data } = await listCatalogFactNodes({
					signal,
					throwOnError: true,
					path: { ...reference, factId: fact.id },
					query: { afterPosition, limit: 128, maxSpoiler: fact.spoiler },
				});
				result.push(...data.items);
				if (result.at(-1)?.position === fact.lastNodePosition) return result;
				if (data.afterPosition === null || data.afterPosition <= afterPosition) break;
				afterPosition = data.afterPosition;
			}
			return null;
		},
	});
	if (fact.lastNodePosition >= 512) return <p>{t.units.nativeSemantics.largeEdit}</p>;
	if (definition.isPending || nodes.isPending) return <QueryPending />;
	if (definition.isError)
		return <QueryFailure error={definition.error} retry={() => void definition.refetch()} />;
	if (nodes.isError) return <QueryFailure error={nodes.error} retry={() => void nodes.refetch()} />;
	const draft = nodes.data ? valueDraftFromNodes(definition.data, nodes.data) : null;
	return draft ? (
		<FactEditor
			reference={reference}
			revision={revision}
			initial={{
				definition: definition.data,
				nodes: draft,
				spoiler: fact.spoiler,
				replaces: { semanticId: fact.semanticId, headVersion: fact.headVersion },
			}}
			onSaved={onSaved}
		/>
	) : (
		<p role="alert">{t.units.nativeSemantics.incompleteValue}</p>
	);
}
