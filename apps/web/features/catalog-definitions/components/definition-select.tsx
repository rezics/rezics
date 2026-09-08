"use client";
import { useState } from "react";
import {
	getCatalogDefinitionRevision,
	useListCatalogDefinitions,
} from "@rezics/openapi-tanstack-query";
import { Badge, Button, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import {
	DefinitionKinds,
	type DefinitionKind,
	type DefinitionSelection,
} from "../model/definition-draft";
import { DefinitionChoice, DefinitionText } from "./definition-fields";
export function DefinitionBrowser({
	kind: fixedKind,
	onPick,
}: {
	kind?: DefinitionKind;
	onPick?: (value: DefinitionSelection) => void;
}) {
	const { t, locale } = useTranslation(["units", "ui"]),
		copy = t.units.nativeDefinitions;
	const [kind, setKind] = useState<DefinitionKind | "">(fixedKind ?? ""),
		[namespace, setNamespace] = useState(""),
		[filter, setFilter] = useState(""),
		[cursors, setCursors] = useState<{ afterNamespace: string; afterKey: string }[]>([]);
	const [loading, setLoading] = useState<string>(),
		[error, setError] = useState<unknown>();
	const page = useListCatalogDefinitions({
		query: {
			kind: fixedKind ?? (kind || undefined),
			namespace: filter || undefined,
			languageTag: locale.target,
			limit: 25,
			...cursors.at(-1),
		},
	});
	async function choose(item: NonNullable<typeof page.data>["items"][number]) {
		if (!item.current || !onPick || loading) return;
		setLoading(item.id);
		setError(undefined);
		try {
			const { data } = await getCatalogDefinitionRevision({
				path: { id: item.current.id },
				throwOnError: true,
			});
			onPick({
				definitionId: item.id,
				namespace: item.namespace,
				key: item.key,
				kind: item.kind,
				revision: data,
			});
		} catch (error) {
			setError(error);
		} finally {
			setLoading(undefined);
		}
	}
	return (
		<div className="grid gap-4">
			<div className="grid gap-3 sm:grid-cols-2">
				{!fixedKind ? (
					<DefinitionChoice
						label={copy.kind}
						value={kind}
						values={["", ...DefinitionKinds]}
						labelFor={(value) => (value ? copy.kinds[value] : copy.any)}
						onChange={(value) => {
							setKind(value);
							setCursors([]);
						}}
					/>
				) : null}
				<DefinitionText label={copy.namespace} value={namespace} onChange={setNamespace} />
			</div>
			<div>
				<Button
					type="button"
					variant="outline"
					onClick={() => {
						setFilter(namespace.trim());
						setCursors([]);
					}}
				>
					{t.ui.search}
				</Button>
				<p className="mt-2 text-sm text-muted-foreground">{copy.namespaceHint}</p>
			</div>
			{page.isPending ? (
				<QueryPending />
			) : page.isError ? (
				<QueryFailure error={page.error} retry={() => void page.refetch()} />
			) : (
				<>
					<ul className="grid gap-2">
						{page.data.items.map((item) => (
							<li
								key={item.id}
								className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
							>
								<div>
									<span lang={item.current?.label?.languageTag}>
										{item.current?.label?.label ?? item.key}
									</span>
									<p className="text-xs text-muted-foreground">
										{item.namespace} / {item.key}
									</p>
								</div>
								<Badge variant="outline">{copy.kinds[item.kind]}</Badge>
								{onPick ? (
									<Button
										type="button"
										disabled={!item.current || Boolean(loading)}
										isLoading={loading === item.id}
										onClick={() => void choose(item)}
									>
										{copy.choose}
									</Button>
								) : (
									<Button asChild variant="outline">
										<AppLink href={`/catalog/definitions/${item.id}`}>{copy.details}</AppLink>
									</Button>
								)}
							</li>
						))}
					</ul>
					{!page.data.items.length ? <p>{copy.empty}</p> : null}
					<div className="flex gap-2">
						{cursors.length ? (
							<Button
								type="button"
								variant="outline"
								onClick={() => setCursors((value) => value.slice(0, -1))}
							>
								{t.ui.shelf.previous}
							</Button>
						) : null}
						{page.data.after ? (
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									const after = page.data.after;
									if (after) setCursors((value) => [...value, after]);
								}}
							>
								{t.ui.shelf.next}
							</Button>
						) : null}
					</div>
				</>
			)}
			<RequestFailure error={error} />
		</div>
	);
}
export function DefinitionSelect({
	label,
	kind,
	value,
	onChange,
}: {
	label: string;
	kind: DefinitionKind;
	value?: DefinitionSelection;
	onChange: (value: DefinitionSelection | undefined) => void;
}) {
	const { t, locale } = useTranslation(["units"]),
		copy = t.units.nativeDefinitions;
	const [open, setOpen] = useState(false);
	return (
		<fieldset className="grid gap-3 rounded-xl border p-3">
			<legend className="px-1 text-sm font-medium">{label}</legend>
			{value ? (
				<div className="flex flex-wrap items-center gap-3">
					<span
						lang={
							value.revision.labels.find((item) => item.languageTag === locale.target)?.languageTag
						}
					>
						{value.revision.labels.find((item) => item.languageTag === locale.target)?.label ??
							value.revision.labels[0]?.label ??
							value.key}
					</span>
					<Button type="button" variant="quiet" onClick={() => onChange(undefined)}>
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
						onChange(item);
						setOpen(false);
					}}
				/>
			) : null}
		</fieldset>
	);
}
