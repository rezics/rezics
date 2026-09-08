"use client";
import {
	useListMusicMedia,
	useAddMusicMedium,
	usePatchMusicMedium,
	useRemoveMusicMedium,
	type ReadMusicDetailStatus200,
	type ListMusicMediaStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, Field, FieldLabel, Input, QueryFailure, QueryPending } from "@rezics/ui";
import { useState, type FormEvent } from "react";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { MusicTracks } from "./music-tracks";
import { MusicHistory } from "./music-history";

type Release = Extract<ReadMusicDetailStatus200, { kind: "release" }>;
export function MusicReleaseMedia({
	detail,
	refresh,
}: {
	detail: Release;
	refresh: () => Promise<void>;
}) {
	const { t } = useTranslation(["units", "ui", "actions"]);
	const [cursors, setCursors] = useState<number[]>([]);
	const [selectedMediumId, setSelectedMediumId] = useState<string | null>(null);
	const query = useListMusicMedia({
		path: { id: detail.id },
		query: { afterPosition: cursors.at(-1), limit: 25 },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<section className="grid gap-5">
			<h2 className="text-xl font-semibold">{t.units.nativeMusic.medium}</h2>
			{!query.data.items.length ? <p>{t.units.nativeMusic.emptyMedia}</p> : null}
			{query.data.items.map((medium) => (
				<Medium
					key={`${medium.id}:${medium.headId}`}
					releaseId={detail.id}
					medium={medium}
					canEdit={detail.canEdit}
					expanded={(selectedMediumId ?? query.data.items[0]?.id) === medium.id}
					select={() => setSelectedMediumId(medium.id)}
					revision={query.data.revision}
					refresh={refresh}
				/>
			))}
			<div className="flex gap-2">
				{cursors.length ? (
					<Button variant="outline" onClick={() => setCursors((value) => value.slice(0, -1))}>
						{t.ui.shelf.previous}
					</Button>
				) : null}
				{query.data.nextCursor !== null ? (
					<Button
						variant="outline"
						onClick={() => {
							const next = query.data.nextCursor;
							if (next !== null) setCursors((value) => [...value, next]);
						}}
					>
						{t.actions.loadMore}
					</Button>
				) : null}
			</div>
			{detail.canEdit ? (
				<MediumForm releaseId={detail.id} revision={query.data.revision} refresh={refresh} />
			) : null}
		</section>
	);
}
function Medium({
	releaseId,
	medium,
	canEdit,
	revision,
	refresh,
	expanded,
	select,
}: {
	releaseId: string;
	expanded: boolean;
	select: () => void;
	medium: ListMusicMediaStatus200["items"][number];
	canEdit: boolean;
	revision: number;
	refresh: () => Promise<void>;
}) {
	const { t } = useTranslation(["units", "ui"]);
	const [editing, setEditing] = useState(false);
	const remove = useRemoveMusicMedium();
	async function removeMedium() {
		if (!medium.headId) return;
		try {
			await remove.mutateAsync({
				path: { id: releaseId, mediumId: medium.id },
				body: { expectedRevision: revision, expectedHeadId: medium.headId },
			});
			await refresh();
		} catch {
			/* Domain rejects a non-empty medium; retain the visible error. */
		}
	}
	return (
		<article className="grid gap-4 rounded-xl border p-4">
			<h3 className="text-lg font-semibold">
				{medium.position}. {medium.name ?? t.units.nativeMusic.medium}
			</h3>
			{canEdit ? (
				<div className="flex gap-2">
					<Button
						variant="outline"
						aria-expanded={editing}
						onClick={() => setEditing((value) => !value)}
					>
						{t.ui.edit}
					</Button>
					<Button variant="quiet" isLoading={remove.isPending} onClick={() => void removeMedium()}>
						{t.units.nativeMusic.remove}
					</Button>
				</div>
			) : null}
			<RequestFailure error={remove.error} />
			{editing && medium.headId ? (
				<MediumForm releaseId={releaseId} revision={revision} medium={medium} refresh={refresh} />
			) : null}
			{canEdit && medium.headId ? (
				<MusicHistory
					id={releaseId}
					component="music_medium"
					componentKey={medium.id}
					expectedRevision={revision}
					expectedHeadId={medium.headId}
					refresh={refresh}
				/>
			) : null}
			<Button variant="outline" aria-expanded={expanded} onClick={select}>
				{t.units.nativeMusic.track}
			</Button>
			{expanded ? (
				<MusicTracks
					releaseId={releaseId}
					mediumId={medium.id}
					canEdit={canEdit}
					refresh={refresh}
				/>
			) : null}
		</article>
	);
}
function MediumForm({
	releaseId,
	revision,
	medium,
	refresh,
}: {
	releaseId: string;
	revision: number;
	medium?: ListMusicMediaStatus200["items"][number];
	refresh: () => Promise<void>;
}) {
	const { t } = useTranslation(["units", "ui"]);
	const [name, setName] = useState(medium?.name ?? "");
	const [position, setPosition] = useState(medium?.position.toString() ?? "");
	const add = useAddMusicMedium();
	const patch = usePatchMusicMedium();
	async function submit(event: FormEvent) {
		event.preventDefault();
		try {
			if (medium?.headId)
				await patch.mutateAsync({
					path: { id: releaseId, mediumId: medium.id },
					body: {
						expectedRevision: revision,
						expectedHeadId: medium.headId,
						value: { name: name || null, position: Number(position) },
					},
				});
			else
				await add.mutateAsync({
					path: { id: releaseId },
					body: { expectedRevision: revision, name: name || null, position: Number(position) },
				});
			await refresh();
			if (!medium) {
				setName("");
				setPosition("");
			}
		} catch {
			/* Retain the submitted draft. */
		}
	}
	const suffix = medium?.id ?? "new";
	return (
		<form className="grid gap-3 rounded-lg border p-3" onSubmit={(event) => void submit(event)}>
			<Field>
				<FieldLabel htmlFor={`medium-name-${suffix}`}>{t.ui.title}</FieldLabel>
				<Input
					id={`medium-name-${suffix}`}
					value={name}
					maxLength={131072}
					onChange={(event) => setName(event.currentTarget.value)}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={`medium-position-${suffix}`}>
					{t.units.nativeMusic.position}
				</FieldLabel>
				<Input
					id={`medium-position-${suffix}`}
					type="number"
					min={0}
					step={1}
					required
					value={position}
					onChange={(event) => setPosition(event.currentTarget.value)}
				/>
			</Field>
			<RequestFailure error={add.error ?? patch.error} />
			<Button type="submit" isLoading={add.isPending || patch.isPending}>
				{medium ? t.ui.save : t.units.nativeMusic.addMedium}
			</Button>
		</form>
	);
}
