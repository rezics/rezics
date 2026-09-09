"use client";
import {
	useListMusicTracks,
	useAddMusicTrack,
	usePatchMusicTrack,
	useRemoveMusicTrack,
	type ListMusicTracksStatus200,
} from "@rezics/openapi-tanstack-query";
import { Button, Field, FieldLabel, Input, QueryFailure, QueryPending } from "@rezics/ui";
import { useState, type FormEvent } from "react";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { MusicHistory } from "./music-history";

type Track = ListMusicTracksStatus200["items"][number];
type TrackContext = { releaseId: string; mediumId: string; refresh: () => Promise<void> };
export function MusicTracks({
	releaseId,
	mediumId,
	canEdit,
	refresh,
}: TrackContext & { canEdit: boolean }) {
	const { t } = useTranslation(["units", "ui", "actions"]);
	const [cursors, setCursors] = useState<number[]>([]);
	const query = useListMusicTracks({
		path: { id: releaseId, mediumId },
		query: { afterPosition: cursors.at(-1), limit: 25 },
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError) return <QueryFailure error={query.error} retry={() => void query.refetch()} />;
	return (
		<div className="grid gap-3">
			{!query.data.items.length ? <p>{t.units.nativeMusic.emptyTracks}</p> : null}
			{query.data.items.map((track) => (
				<TrackRow
					key={`${track.id}:${track.headId}`}
					track={track}
					releaseId={releaseId}
					mediumId={mediumId}
					canEdit={canEdit}
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
			{canEdit ? (
				<TrackForm
					releaseId={releaseId}
					mediumId={mediumId}
					revision={query.data.revision}
					refresh={refresh}
				/>
			) : null}
		</div>
	);
}
function TrackRow({
	track,
	releaseId,
	mediumId,
	canEdit,
	revision,
	refresh,
}: TrackContext & { track: Track; canEdit: boolean; revision: number }) {
	const { t } = useTranslation(["units", "ui"]);
	const [editing, setEditing] = useState(false);
	const remove = useRemoveMusicTrack();
	async function removeTrack() {
		if (!track.headId) return;
		try {
			await remove.mutateAsync({
				path: { id: releaseId, trackId: track.id },
				body: { expectedRevision: revision, expectedHeadId: track.headId },
			});
			await refresh();
		} catch {
			/* Show the exact conflict without retrying the mutation. */
		}
	}
	return (
		<div className="grid gap-2 border-b pb-3">
			<div className="flex flex-wrap items-center gap-3">
				<span>{track.number}</span>
				<span className="flex-1 break-words">{track.name ?? t.ui.unnamed}</span>
				{track.lengthMilliseconds !== null ? (
					<span>
						{`${Math.floor(track.lengthMilliseconds / 60000)}:${Math.floor(track.lengthMilliseconds / 1000) % 60}`.replace(
							/:(\d)$/u,
							":0$1",
						)}
					</span>
				) : null}
			</div>
			{track.recordingId ? (
				<Link href={`/catalog/music/${track.recordingId}`} className="underline">
					{t.units.nativeMusic.recording}
				</Link>
			) : null}
			{canEdit ? (
				<div className="flex gap-2">
					<Button
						variant="outline"
						aria-expanded={editing}
						onClick={() => setEditing((value) => !value)}
					>
						{t.ui.edit}
					</Button>
					<Button variant="quiet" isLoading={remove.isPending} onClick={() => void removeTrack()}>
						{t.units.nativeMusic.remove}
					</Button>
				</div>
			) : null}
			<RequestFailure error={remove.error} />
			{editing ? (
				<TrackForm
					releaseId={releaseId}
					mediumId={mediumId}
					revision={revision}
					track={track}
					refresh={refresh}
				/>
			) : null}
			{canEdit && track.headId ? (
				<MusicHistory
					id={releaseId}
					component="music_track_occurrence"
					componentKey={track.id}
					expectedRevision={revision}
					expectedHeadId={track.headId}
					refresh={refresh}
				/>
			) : null}
		</div>
	);
}
function TrackForm({
	releaseId,
	mediumId,
	revision,
	track,
	refresh,
}: TrackContext & { revision: number; track?: Track }) {
	const { t } = useTranslation(["units", "ui"]);
	const [name, setName] = useState(track?.name ?? "");
	const [number, setNumber] = useState(track?.number ?? "");
	const [position, setPosition] = useState(track?.position.toString() ?? "");
	const [duration, setDuration] = useState(track?.lengthMilliseconds?.toString() ?? "");
	const add = useAddMusicTrack();
	const patch = usePatchMusicTrack();
	async function submit(event: FormEvent) {
		event.preventDefault();
		const value = {
			name: name || null,
			number,
			position: Number(position),
			lengthMilliseconds: duration === "" ? null : Number(duration),
		};
		try {
			if (track?.headId)
				await patch.mutateAsync({
					path: { id: releaseId, trackId: track.id },
					body: { expectedRevision: revision, expectedHeadId: track.headId, value },
				});
			else
				await add.mutateAsync({
					path: { id: releaseId, mediumId },
					body: {
						expectedRevision: revision,
						value: { ...value, recordingId: null, artistCreditId: null, isDataTrack: null },
					},
				});
			await refresh();
			if (!track) {
				setName("");
				setNumber("");
				setPosition("");
				setDuration("");
			}
		} catch {
			/* Keep values available for correction. */
		}
	}
	const suffix = track?.id ?? mediumId;
	return (
		<form className="grid gap-3 rounded-lg border p-3" onSubmit={(event) => void submit(event)}>
			<Field>
				<FieldLabel htmlFor={`track-name-${suffix}`}>{t.ui.title}</FieldLabel>
				<Input
					id={`track-name-${suffix}`}
					maxLength={131072}
					value={name}
					onChange={(event) => setName(event.currentTarget.value)}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={`track-number-${suffix}`}>{t.units.nativeMusic.number}</FieldLabel>
				<Input
					id={`track-number-${suffix}`}
					maxLength={131072}
					required
					value={number}
					onChange={(event) => setNumber(event.currentTarget.value)}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={`track-position-${suffix}`}>{t.units.nativeMusic.position}</FieldLabel>
				<Input
					id={`track-position-${suffix}`}
					type="number"
					min={0}
					step={1}
					required
					value={position}
					onChange={(event) => setPosition(event.currentTarget.value)}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={`track-duration-${suffix}`}>{t.units.nativeMusic.duration}</FieldLabel>
				<Input
					id={`track-duration-${suffix}`}
					type="number"
					min={0}
					step={1}
					value={duration}
					onChange={(event) => setDuration(event.currentTarget.value)}
				/>
			</Field>
			<RequestFailure error={add.error ?? patch.error} />
			<Button type="submit" isLoading={add.isPending || patch.isPending}>
				{track ? t.ui.save : t.units.nativeMusic.addTrack}
			</Button>
		</form>
	);
}
