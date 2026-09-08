import { isDeepStrictEqual } from "node:util";
import { MUSIC_SOURCE_OCCURRENCE_LIMIT, MUSIC_SOURCE_AUXILIARY_ROW_LIMIT } from "../database/schema/catalog-source-limits";
import type { MusicBrainzRelease } from "./musicbrainz";

type Medium = MusicBrainzRelease["media"][number];
export function tracks(medium: Medium, index: number) {
	return [
		...(medium.pregap
			? [{ track: medium.pregap, data: false, path: `/media/${index}/pregap` }]
			: []),
		...(medium.tracks ?? []).map((track, position) => ({
			track,
			data: false,
			path: `/media/${index}/tracks/${position}`,
		})),
		...(medium["data-tracks"] ?? []).map((track, position) => ({
			track,
			data: true,
			path: `/media/${index}/data-tracks/${position}`,
		})),
	];
}

/** @internal Medium occurrence correspondence uses persistent IDs or track membership; ambiguous merges fail explicitly. */
export function correlateMusicBrainzMedia(
	previous: MusicBrainzRelease,
	incoming: MusicBrainzRelease,
) {
	const used = new Set<number>();
	const byId = new Map<string, number[]>(), byTrack = new Map<string, Set<number>>(), byOccurrence = new Map<string, number[]>();
	const occurrenceKey = (medium: Medium) => JSON.stringify({ position: medium.position, title: medium.title, formatId: medium["format-id"], format: medium.format });
	for (const [index, medium] of previous.media.entries()) {
		if (medium.id) { const matches = byId.get(medium.id) ?? []; matches.push(index); byId.set(medium.id, matches); }
		else { const key = occurrenceKey(medium), matches = byOccurrence.get(key) ?? []; matches.push(index); byOccurrence.set(key, matches); }
		for (const entry of tracks(medium, index)) { const matches = byTrack.get(entry.track.id) ?? new Set<number>(); matches.add(index); byTrack.set(entry.track.id, matches); }
	}
	return incoming.media.map((medium, index) => {
		const matched = new Set(medium.id ? byId.get(medium.id) ?? [] : []);
		for (const entry of tracks(medium, index)) for (const oldIndex of byTrack.get(entry.track.id) ?? []) matched.add(oldIndex);
		const candidates = [...matched];
		if (candidates.length > 1)
			throw new TypeError("Medium merge requires an explicit reviewed structural mapping");
		let match = candidates[0];
		if (match === undefined) {
			const sameOccurrence = medium.id ? [] : (byOccurrence.get(occurrenceKey(medium)) ?? []).filter((oldIndex) => !used.has(oldIndex));
			match = sameOccurrence.length === 1 ? sameOccurrence[0] : undefined;
		}
		if (match !== undefined && used.has(match))
			throw new TypeError("Medium split requires an explicit reviewed structural mapping");
		if (match !== undefined) used.add(match);
		return match ?? null;
	});
}

/** @internal This is an admission bound for the ordinary atomic mapper, not a lifetime limit of native owners. */
export function preflightMusicBrainzReleaseDelta(
	previous: MusicBrainzRelease,
	incoming: MusicBrainzRelease,
) {
	if (previous.id !== incoming.id) throw new TypeError("Release delta crosses source identity");
	// Archive byte admission and source occurrence admission are read-work bounds. Actual
	// mutations are counted only after fieldwise source/native reconciliation.
	for (const release of [previous, incoming]) {
		const occurrences = 1 + (release["label-info"]?.length ?? 0) +
			(release["release-events"]?.length ?? (release.date ? 1 : 0)) +
			release.media.reduce((total, medium, index) => total + 1 + Number(Boolean(medium.id)) +
				tracks(medium, index).length * 2 + (medium.discs?.length ?? 0), 0);
		if (occurrences > MUSIC_SOURCE_OCCURRENCE_LIMIT)
			throw new RangeError("Music release source support exceeds the staged publication capacity");
	}
	for (const release of [previous, incoming]) {
		const ids = release.media.flatMap((medium, index) =>
			tracks(medium, index).map((entry) => entry.track.id),
		);
		if (new Set(ids).size !== ids.length)
			throw new TypeError("Duplicate MusicBrainz track identity in one release");
	}
	if (musicBrainzReleaseAuxiliaryRows(previous, incoming) > MUSIC_SOURCE_AUXILIARY_ROW_LIMIT) throw new RangeError("Music release auxiliary writes exceed the publication capacity");
}

/** @internal Exact document equality with linear occurrence consumption, including duplicate TOC evidence. */
export function correlateMusicBrainzDiscs(previous: NonNullable<Medium["discs"]>, incoming: NonNullable<Medium["discs"]>) {
	const canonical = (value: unknown): string => value !== null && typeof value === "object"
		? Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`
		: JSON.stringify(value) ?? "undefined";
	const rows = new Map<string, { indices: number[]; next: number }>();
	for (const [index, disc] of previous.entries()) { const key = canonical(disc), row = rows.get(key) ?? { indices: [], next: 0 }; row.indices.push(index); rows.set(key, row); }
	return incoming.map((disc) => { const row = rows.get(canonical(disc)); return row && row.next < row.indices.length ? row.indices[row.next++]! : null; });
}

/** @internal Count new credit-fragment rows and TOC offsets separately from structural mutations. */
export function musicBrainzReleaseAuxiliaryRows(previous: MusicBrainzRelease | null, incoming: MusicBrainzRelease) {
	let count = 0;
	const creditSignatures = new Set<string>();
	const credit = (before: MusicBrainzRelease["artist-credit"], after: MusicBrainzRelease["artist-credit"]) => {
		if (!after?.length || isDeepStrictEqual(before, after)) return;
		const signature = JSON.stringify(after.map((member) => [member.artist.id, member.name, member.joinphrase ?? ""]));
		if (!creditSignatures.has(signature)) { creditSignatures.add(signature); count += 2 + after.length; }
	};
	credit(previous?.["artist-credit"], incoming["artist-credit"]);
	const oldTracks = new Map(previous?.media.flatMap((medium, index) => tracks(medium, index).map((entry) => [entry.track.id, entry.track] as const)) ?? []);
	const correspondence = previous ? correlateMusicBrainzMedia(previous, incoming) : incoming.media.map(() => null);
	for (const [index, medium] of incoming.media.entries()) {
		for (const entry of tracks(medium, index)) credit(oldTracks.get(entry.track.id)?.["artist-credit"], entry.track["artist-credit"]);
		const oldIndex = correspondence[index];
		const oldDiscs = oldIndex == null ? [] : previous?.media[oldIndex]?.discs ?? [];
		const discs = medium.discs ?? [], matched = correlateMusicBrainzDiscs(oldDiscs, discs);
		for (const [discIndex, disc] of discs.entries()) if (matched[discIndex] === null) count += 1 + disc.offsets.length;
	}
	return count;
}
