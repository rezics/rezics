"use client";
import { useState } from "react";
import { useFindSoftwareReleases, useListProgramOccurrences } from "@rezics/openapi-tanstack-query";
import { Button, Field, FieldLabel, NativeSelect, QueryFailure, QueryPending } from "@rezics/ui";
import { AppLink } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { DomainField } from "./domain-field";

export function SoftwareReleaseList({ id }: { id: string }) {
	const { t } = useTranslation(["units", "ui"]);
	const [language, setLanguage] = useState("");
	const [machineTranslated, setMachineTranslated] = useState<"true" | "false" | undefined>();
	const [filter, setFilter] = useState<{
		languageTag?: string;
		machineTranslated?: "true" | "false";
	}>({});
	return (
		<section className="grid gap-3">
			<h2 className="text-lg font-semibold">{t.units.nativeDomain.releases}</h2>
			<form
				className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
				onSubmit={(event) => {
					event.preventDefault();
					setFilter({ languageTag: language.trim() || undefined, machineTranslated });
				}}
			>
				<DomainField
					label={t.units.nativeDomain.language}
					value={language}
					onChange={setLanguage}
				/>
				<Field>
					<FieldLabel>{t.units.nativeDomain.machineTranslated}</FieldLabel>
					<NativeSelect
						value={machineTranslated ?? ""}
						onChange={(event) => {
							const value = event.target.value;
							if (value === "" || value === "true" || value === "false")
								setMachineTranslated(value || undefined);
						}}
					>
						<option value="">{t.units.nativeDomain.any}</option>
						<option value="true">{t.units.nativeDomain.yes}</option>
						<option value="false">{t.units.nativeDomain.no}</option>
					</NativeSelect>
				</Field>
				<Button type="submit">{t.ui.search}</Button>
			</form>
			<ReleasePage key={JSON.stringify([id, filter])} id={id} filter={filter} />
		</section>
	);
}
function ReleasePage({
	id,
	filter,
}: {
	id: string;
	filter: { languageTag?: string; machineTranslated?: "true" | "false" };
}) {
	const { t } = useTranslation(["units", "ui"]);
	const [cursors, setCursors] = useState<string[]>([]);
	const query = useFindSoftwareReleases({
		path: { id },
		query: { ...filter, limit: 20, cursor: cursors.at(-1) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<>
			<ul className="grid gap-2">
				{query.data.items.map((item) => (
					<li key={item.id}>
						<AppLink
							className="underline underline-offset-4"
							href={`/catalog/software/${item.id}`}
							lang={item.name?.languageTag ?? undefined}
						>
							{item.name?.value ??
								([item.dateYear, item.dateMonth, item.dateDay]
									.filter((value) => value !== null)
									.join("-") ||
									item.engine ||
									t.ui.unnamed)}
						</AppLink>
					</li>
				))}
			</ul>
			{!query.data.items.length && !cursors.length && !query.data.nextCursor ? (
				<p className="text-muted-foreground">{t.units.nativeDomain.emptyReleases}</p>
			) : null}
			<CursorButtons cursors={cursors} next={query.data.nextCursor} setCursors={setCursors} />
		</>
	);
}
export function ProgramEpisodeList({ id }: { id: string }) {
	const { t } = useTranslation(["units", "ui"]);
	const [cursors, setCursors] = useState<string[]>([]);
	const query = useListProgramOccurrences({
		path: { id },
		query: { limit: 30, cursor: cursors.at(-1) },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	if (!query.data.items.length && !cursors.length && !query.data.nextCursor) return null;
	return (
		<section className="grid gap-3">
			<h2 className="text-lg font-semibold">{t.units.nativeDomain.episodes}</h2>
			<ol className="grid gap-2">
				{query.data.items.map((item) => (
					<li key={item.id}>
						<AppLink
							className="underline underline-offset-4"
							href={`/catalog/program/${item.value.episodeId}`}
							lang={item.name?.languageTag ?? undefined}
						>
							{item.name?.value ?? item.value.sourceNumber ?? t.ui.unnamed}
						</AppLink>
					</li>
				))}
			</ol>
			<CursorButtons cursors={cursors} next={query.data.nextCursor} setCursors={setCursors} />
		</section>
	);
}
function CursorButtons({
	cursors,
	next,
	setCursors,
}: {
	cursors: string[];
	next: string | null;
	setCursors: (value: string[]) => void;
}) {
	const { t } = useTranslation(["ui", "actions"]);
	return (
		<div className="flex gap-2">
			{cursors.length ? (
				<Button variant="outline" onClick={() => setCursors(cursors.slice(0, -1))}>
					{t.ui.shelf.previous}
				</Button>
			) : null}
			{next ? (
				<Button variant="outline" onClick={() => setCursors([...cursors, next])}>
					{t.actions.loadMore}
				</Button>
			) : null}
		</div>
	);
}
