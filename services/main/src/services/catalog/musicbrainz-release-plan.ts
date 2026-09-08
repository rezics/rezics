import { MUSIC_SOURCE_OCCURRENCE_LIMIT } from "../database/schema/catalog-source-limits";
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
	return incoming.media.map((medium, index) => {
		const ids = new Set(tracks(medium, index).map((entry) => entry.track.id));
		const candidates = previous.media.flatMap((old, oldIndex) =>
			(medium.id && old.id === medium.id) ||
			tracks(old, oldIndex).some((entry) => ids.has(entry.track.id))
				? [oldIndex]
				: [],
		);
		if (candidates.length > 1)
			throw new TypeError("Medium merge requires an explicit reviewed structural mapping");
		let match = candidates[0];
		if (match === undefined) {
			const sameOccurrence = previous.media.flatMap((old, oldIndex) =>
				!used.has(oldIndex) &&
				!medium.id &&
				!old.id &&
				old.position === medium.position &&
				old.title === medium.title &&
				old["format-id"] === medium["format-id"] &&
				old.format === medium.format
					? [oldIndex]
					: [],
			);
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
}
