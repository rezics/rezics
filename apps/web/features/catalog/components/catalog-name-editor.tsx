"use client";
import { useState } from "react";
import type { CatalogReference } from "@rezics/reference";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import {
	useListCatalogNames,
	useAddCatalogName,
	useReviseCatalogName,
} from "@rezics/openapi-tanstack-query";
import type {
	ListCatalogNamesStatus200,
	ReviseCatalogNameBody,
} from "@rezics/openapi-tanstack-query";
import { Button, QueryFailure, QueryPending } from "@rezics/ui";
import {
	DefinitionText,
	DefinitionFlag,
	DefinitionChoice,
} from "@/features/catalog-definitions/components/definition-fields";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
type NamedForm = ListCatalogNamesStatus200["items"][number];
export function CatalogNameEditor({
	reference,
	revision,
	onChanged,
}: {
	reference: CatalogReference;
	revision: number;
	onChanged: () => void;
}) {
	const { t, locale } = useTranslation(["units", "ui"]),
		copy = t.units.nativeEditorial;
	const [cursors, setCursors] = useState<string[]>([]),
		[spoiler, setSpoiler] = useState<0 | 1 | 2>(0),
		[value, setValue] = useState(""),
		[language, setLanguage] = useState<string>(locale.target),
		[primary, setPrimary] = useState(false),
		[invalid, setInvalid] = useState(false);
	const query = useListCatalogNames({
			path: reference,
			query: { limit: 25, afterId: cursors.at(-1), maxSpoiler: spoiler },
		}),
		add = useAddCatalogName();
	const changed = () => {
		void query.refetch();
		onChanged();
	};
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-3 rounded border p-4">
			<h2 className="font-semibold">{t.units.nativeCatalog.names}</h2>
			<DefinitionChoice
				label={t.units.nativeSemantics.spoilerVisibility}
				value={String(spoiler)}
				values={["0", "1", "2"]}
				labelFor={(value) =>
					value === "0"
						? t.units.nativeSemantics.spoilerNone
						: value === "1"
							? t.units.nativeSemantics.spoilerMinor
							: t.units.nativeSemantics.spoilerMajor
				}
				onChange={(value) => {
					setSpoiler(value === "0" ? 0 : value === "1" ? 1 : 2);
					setCursors([]);
				}}
			/>
			{query.data.items.map((name) => (
				<NameValueEditor
					key={`${name.id}:${name.revision}`}
					reference={reference}
					name={name}
					onChanged={changed}
				/>
			))}
			<div className="flex gap-2">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors((value) => value.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.nextCursor ? (
					<Button
						variant="outline"
						onClick={() => {
							const next = query.data.nextCursor;
							if (next) setCursors((value) => [...value, next]);
						}}
					>
						{t.ui.shelf.next}
					</Button>
				) : null}
			</div>
			<DefinitionText label={copy.name} value={value} onChange={setValue} />
			<DefinitionText label={copy.language} value={language} onChange={setLanguage} />
			<DefinitionFlag label={copy.primaryName} value={primary} onChange={setPrimary} />
			{invalid ? <p role="alert">{copy.invalidLanguage}</p> : null}
			<Button
				disabled={!value.trim() || add.isPending}
				onClick={() => {
					let languageTag: string | null;
					try {
						languageTag = language.trim() ? canonicalizeContentLanguageTag(language) : null;
					} catch {
						setInvalid(true);
						return;
					}
					setInvalid(false);
					void add
						.mutateAsync({
							path: reference,
							body: {
								expectedRevision: revision,
								value: {
									value: value.trim(),
									kind: primary ? "primary" : "alias",
									languageTag,
									primaryForLanguage: primary,
								},
							},
						})
						.then(() => {
							setValue("");
							changed();
						})
						.catch(() => undefined);
				}}
			>
				{copy.addName}
			</Button>
			<RequestFailure error={add.error} />
		</section>
	);
}
function NameValueEditor({
	reference,
	name,
	onChanged,
}: {
	reference: CatalogReference;
	name: NamedForm;
	onChanged: () => void;
}) {
	const { t } = useTranslation(["ui", "units"]),
		[editing, setEditing] = useState(false),
		[value, setValue] = useState(name.value),
		change = useReviseCatalogName();
	return (
		<article className="grid gap-2 rounded border p-3">
			<p lang={name.languageTag ?? undefined}>{name.value}</p>
			<Button
				variant="quiet"
				aria-expanded={editing}
				onClick={() => setEditing((current) => !current)}
			>
				{t.ui.edit}
			</Button>
			{editing ? (
				<>
					<DefinitionText label={t.units.nativeEditorial.name} value={value} onChange={setValue} />
					<Button
						disabled={!value.trim() || change.isPending}
						onClick={() => {
							const next: ReviseCatalogNameBody["value"] = {
								value: value.trim(),
								kind: name.kind,
								languageTag: name.languageTag,
								privateUseNamespace: name.privateUseNamespace,
								sortName: name.sortName,
								origin: name.origin,
								translationMethod: name.translationMethod,
								primaryForLanguage: name.primaryForLanguage,
								scopeOwnerId: name.scopeOwnerId,
								territory: name.territory,
								context: name.context,
								derivationNameId: name.derivationNameId,
								derivationRevision: name.derivationRevision,
								begin: name.begin,
								end: name.end,
								ended: name.ended,
								spoiler: name.spoiler,
								state: name.state,
							};
							void change
								.mutateAsync({
									path: { ...reference, nameId: name.id },
									body: { expectedRevision: name.revision, value: next },
								})
								.then(() => {
									setEditing(false);
									onChanged();
								})
								.catch(() => undefined);
						}}
					>
						{t.ui.save}
					</Button>
				</>
			) : null}
			<RequestFailure error={change.error} />
		</article>
	);
}
