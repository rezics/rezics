"use client";
import { useState } from "react";
import { useGetCatalogDefinitionRevision } from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { definitionLabel, type DefinitionKind } from "../model/definition-draft";
import { DefinitionBrowser } from "./definition-select";
export function DefinitionRevisionLabel({ id }: { id: string }) {
	const { t } = useTranslation(["units"]);
	const [expanded, setExpanded] = useState(false);
	return expanded ? (
		<ResolvedRevisionLabel id={id} />
	) : (
		<Button type="button" variant="ghost" onClick={() => setExpanded(true)}>
			{t.units.nativeDefinitions.details}
		</Button>
	);
}
function ResolvedRevisionLabel({ id }: { id: string }) {
	const { t, locale } = useTranslation(["units"]);
	const query = useGetCatalogDefinitionRevision({ path: { id } });
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<AppLink
			className="underline underline-offset-4"
			href={`/catalog/definitions/${query.data.definitionId}?revision=${id}`}
		>
			{definitionLabel(query.data, locale.target) ?? t.units.nativeDefinitions.details}
		</AppLink>
	);
}
export function DefinitionRevisionPicker({
	label,
	kind,
	value,
	onChange,
}: {
	label: string;
	kind: DefinitionKind;
	value?: string;
	onChange: (id: string | undefined) => void;
}) {
	const { t } = useTranslation(["units"]),
		copy = t.units.nativeDefinitions;
	const [open, setOpen] = useState(false);
	return (
		<fieldset className="grid gap-3 rounded-xl border p-3">
			<legend className="px-1 text-sm font-medium">{label}</legend>
			{value ? (
				<div className="flex flex-wrap items-center gap-3">
					<DefinitionRevisionLabel id={value} />
					<Button type="button" variant="ghost" onClick={() => onChange(undefined)}>
						{copy.remove}
					</Button>
				</div>
			) : null}
			<Button
				type="button"
				variant="outline"
				aria-expanded={open}
				onClick={() => setOpen((current) => !current)}
			>
				{copy.choose}
			</Button>
			{open ? (
				<DefinitionBrowser
					kind={kind}
					onPick={(item) => {
						onChange(item.revision.id);
						setOpen(false);
					}}
				/>
			) : null}
		</fieldset>
	);
}
