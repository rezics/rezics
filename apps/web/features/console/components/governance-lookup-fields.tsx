"use client";
import { useState } from "react";
import { z } from "zod";
import { isSlugLabel } from "@rezics/slug";
import type { GetApiGovernancePlatformUnitsQuery } from "@rezics/openapi-tanstack-query";
import { Button } from "@rezics/ui";
import {
	DefinitionChoice,
	DefinitionText,
} from "@/features/catalog-definitions/components/definition-fields";
import { useTranslation } from "@/i18n/client";
export type GovernanceLookup = Pick<
	GetApiGovernancePlatformUnitsQuery,
	"query" | "scopeNamespaceId" | "scopeUnitId"
>;

export function GovernanceLookupFields({
	initialQuery = "",
	onApply,
}: {
	initialQuery?: string;
	onApply: (lookup: GovernanceLookup) => void;
}) {
	const { t } = useTranslation(["console", "ui"]),
		copy = t.console.nativeLookup;
	const [mode, setMode] = useState<"browse" | "id" | "namespace" | "unit">(
			initialQuery ? "id" : "browse",
		),
		[query, setQuery] = useState(initialQuery),
		[scope, setScope] = useState(""),
		[invalid, setInvalid] = useState(false);
	function apply() {
		const value = query.trim(),
			scopeId = z.uuid().safeParse(scope.trim());
		if (mode === "browse") {
			setInvalid(false);
			onApply({});
			return;
		}
		if (mode === "id") {
			const id = z.uuid().safeParse(value);
			if (!id.success) {
				setInvalid(true);
				return;
			}
			setInvalid(false);
			onApply({ query: id.data });
			return;
		}
		if (!scopeId.success || !isSlugLabel(value)) {
			setInvalid(true);
			return;
		}
		setInvalid(false);
		onApply(
			mode === "namespace"
				? { query: value, scopeNamespaceId: scopeId.data }
				: { query: value, scopeUnitId: scopeId.data },
		);
	}
	return (
		<div className="grid gap-3">
			<DefinitionChoice
				label={copy.mode}
				value={mode}
				values={["browse", "id", "namespace", "unit"]}
				labelFor={(value) => copy.modes[value]}
				onChange={(value) => {
					setMode(value);
					setInvalid(false);
				}}
			/>
			{mode !== "browse" ? (
				<DefinitionText
					label={mode === "id" ? copy.identifier : copy.address}
					value={query}
					onChange={setQuery}
				/>
			) : null}
			{mode === "namespace" || mode === "unit" ? (
				<DefinitionText label={copy.scopeIdentifier} value={scope} onChange={setScope} />
			) : null}
			{invalid ? <p role="alert">{copy.invalid}</p> : null}
			<Button variant="outline" type="button" onClick={apply}>
				{t.ui.search}
			</Button>
		</div>
	);
}
