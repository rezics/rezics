import { z } from "zod";
import { MusicBrainzCatalogContractSha256 } from "./musicbrainz";
import { musicBrainzObjectNativeWriter } from "./musicbrainz-object-delta";
import { musicBrainzReleaseNativeWriter } from "./musicbrainz-release-delta";
import { compensateMusicSourceApplication } from "./music-source-compensation";
import type { CatalogSourceReceipt } from "./source-observations";
import type { CatalogSourceNativeWriter } from "./source-proposals";

type ArchivedSnapshot = Readonly<{
	snapshotId: string;
	receipt: CatalogSourceReceipt;
	bytes: Uint8Array;
}>;

/** @internal Selects an offline native callback from immutable archives loaded by the runtime. */
export function createMusicBrainzNativeWriter(input: {
	before: ArchivedSnapshot | null;
	after: ArchivedSnapshot;
}): CatalogSourceNativeWriter {
	const { before, after } = input;
	for (const archive of before ? [before, after] : [after]) {
		z.uuid().parse(archive.snapshotId);
		if (
			archive.receipt.key.source !== "musicbrainz" ||
			archive.receipt.contractSha256 !== MusicBrainzCatalogContractSha256
		)
			throw new TypeError("Unreviewed MusicBrainz archive contract");
	}
	if (
		before &&
		(before.receipt.key.objectType !== after.receipt.key.objectType ||
			before.receipt.key.externalId !== after.receipt.key.externalId)
	)
		throw new TypeError("MusicBrainz update archives cross source identity");
	const kind = after.receipt.key.objectType;
	if (!["release", "work", "recording", "release_group"].includes(kind))
		throw new TypeError(`MusicBrainz ${kind} has no qualified native update writer`);
	// Missing previous evidence must never be interpreted as an empty native owner.
	// A new correspondence needs its persisted interpretation before refresh can apply.
	return async (tx, context) => {
		if (context.snapshotId !== after.snapshotId)
			throw new TypeError("MusicBrainz callback snapshot differs from its proposal");
		if (context.action === "withdraw") return compensateMusicSourceApplication(tx, context);
		if (!before)
			throw new TypeError(
				"MusicBrainz correspondence refresh requires a persisted prior interpretation",
			);
		if (context.previousSnapshotId !== before.snapshotId)
			throw new TypeError("MusicBrainz callback previous snapshot differs from its proposal");
		const writer =
			kind === "release"
				? musicBrainzReleaseNativeWriter(before, after)
				: musicBrainzObjectNativeWriter(before, after);
		return writer(tx, context);
	};
}
