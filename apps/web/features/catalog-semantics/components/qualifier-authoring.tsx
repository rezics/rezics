"use client";
import { useState } from "react";
import { useGetCatalogDefinitionRevision } from "@rezics/openapi-tanstack-query";
import type { CatalogReference } from "@rezics/reference";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { ValueEditor } from "./value-editor";
import { QualifierPicker } from "./qualifier-picker";
import {
	buildFactBody,
	initialValueDraft,
	type QualifierDraft,
	type ValueDraftNode,
} from "../model/semantic-draft";

export function QualifierAuthoring({
	reference,
	revision,
	definitionRevisionId,
	spoiler,
	onPick,
}: {
	reference: CatalogReference;
	revision: number;
	definitionRevisionId: string;
	spoiler: 0 | 1 | 2;
	onPick: (value: QualifierDraft) => void;
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeSemantics;
	const [edited, setEdited] = useState<ValueDraftNode[]>(),
		[reuse, setReuse] = useState(false),
		[invalid, setInvalid] = useState(false);
	const definition = useGetCatalogDefinitionRevision({ path: { id: definitionRevisionId } });
	if (definition.isPending) return <QueryPending />;
	if (definition.isError)
		return <QueryFailure error={definition.error} retry={() => void definition.refetch()} />;
	const nodes = edited ?? initialValueDraft(definition.data);
	return (
		<section className="grid gap-3 rounded border p-3">
			<h4 className="font-medium">{copy.authorQualifier}</h4>
			<ValueEditor definition={definition.data} rows={nodes} onChange={setEdited} />
			{invalid ? <p role="alert">{copy.invalid}</p> : null}
			<Button
				type="button"
				onClick={() => {
					if (!buildFactBody(definition.data, nodes, revision, spoiler)) {
						setInvalid(true);
						return;
					}
					onPick({ definitionRevisionId, definition: definition.data, nodes });
				}}
			>
				{copy.addQualifier}
			</Button>
			<Button
				variant="outline"
				type="button"
				aria-expanded={reuse}
				onClick={() => setReuse((value) => !value)}
			>
				{copy.reuseQualifier}
			</Button>
			{reuse ? (
				<QualifierPicker
					reference={reference}
					definitionRevisionId={definitionRevisionId}
					spoiler={spoiler}
					onPick={(valueFactId) => onPick({ definitionRevisionId, valueFactId })}
				/>
			) : null}
		</section>
	);
}
