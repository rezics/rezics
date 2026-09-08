import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import type { CatalogSourceReceipt } from "./source-observations";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import { VndbAcquisitionObjectTypeSchema } from "./vndb-acquisition";
import { MusicBrainzLookupObjectTypes } from "./musicbrainz-acquisition";
import { adoptVndbVn } from "./vndb-adoption";
import { adoptVndbRelease } from "./vndb-release";
import { adoptVndbStaff, adoptVndbProducer, adoptVndbCharacter } from "./vndb-entities";
import { adoptVndbSemanticObject } from "./vndb-semantics";
import { createVndbVnNativeWriter } from "./vndb-vn-update";
import { createVndbReleaseNativeWriter } from "./vndb-release-update";
import { createVndbSupportingNativeWriter } from "./vndb-supporting-update";
import { adoptMusicBrainzRelease } from "./musicbrainz-adoption";
import { adoptMusicBrainzObject } from "./musicbrainz-object-adoption";
import { adoptMusicBrainzSupportingEndpoint } from "./musicbrainz-entities-adoption";
import { musicBrainzReleaseNativeWriter } from "./musicbrainz-release-delta";
import { musicBrainzObjectNativeWriter } from "./musicbrainz-object-delta";
import { musicBrainzSupportingNativeWriter } from "./musicbrainz-supporting-delta";
import { adoptBangumiSubject } from "./source-adoption";
import { adoptBangumiEntity, adoptBangumiProgramEpisode } from "./bangumi-adoption";
import { adoptBangumiIndex } from "./bangumi-index";
import { createBangumiNativeWriter } from "./bangumi-native";
import { adoptOpenLibraryRecord, createOpenLibraryNativeWriter } from "./openlibrary-adoption";

/** @alpha Provider-specific component boundaries preserve each family's enum in generated clients. */
export const CatalogSourceIntakeModels = {
	VndbSourceIntake: z.strictObject({ source: z.literal("vndb"), objectType: VndbAcquisitionObjectTypeSchema, externalId: z.string().min(1).max(512) }).meta({ $id: "VndbSourceIntake" }),
	MusicBrainzSourceIntake: z.strictObject({ source: z.literal("musicbrainz"), objectType: z.enum(MusicBrainzLookupObjectTypes), externalId: z.uuid() }).meta({ $id: "MusicBrainzSourceIntake" }),
	BangumiSourceIntake: z.strictObject({ source: z.literal("bangumi"), objectType: z.enum(["subject", "person", "character", "episode", "index"]), externalId: z.string().regex(/^[1-9][0-9]*$/u) }).meta({ $id: "BangumiSourceIntake" }),
	OpenLibrarySourceIntake: z.strictObject({ source: z.literal("openlibrary"), objectType: z.enum(["work", "edition", "author"]), externalId: z.string().min(1).max(512) }).meta({ $id: "OpenLibrarySourceIntake" }),
};
/** @alpha Principal identities admitted by human lookup. Related paged/dump families keep their explicit scopes. */
export const CatalogSourceIntakeKeySchema = z.discriminatedUnion("source", [
	CatalogSourceIntakeModels.VndbSourceIntake,
	CatalogSourceIntakeModels.MusicBrainzSourceIntake,
	CatalogSourceIntakeModels.BangumiSourceIntake,
	CatalogSourceIntakeModels.OpenLibrarySourceIntake,
]);
export type NativeSourceSnapshot = { receipt: CatalogSourceReceipt; bytes: Uint8Array; snapshotId: string };

/** @internal Every dispatch invokes the real native owner command; raw source rows are never promoted as catalog objects. */
export async function adoptCatalogSourcePrincipal(tx: DatabaseTransaction, actor: string, snapshot: NativeSourceSnapshot) {
	const { receipt, bytes } = snapshot;
	const key = CatalogSourceIntakeKeySchema.parse(receipt.key);
	switch (key.source) {
		case "vndb":
			switch (key.objectType) {
				case "vn": return adoptVndbVn(tx, actor, receipt, bytes);
				case "release": return adoptVndbRelease(tx, actor, receipt, bytes);
				case "staff": return adoptVndbStaff(tx, actor, receipt, bytes);
				case "producer": return adoptVndbProducer(tx, actor, receipt, bytes);
				case "character": return adoptVndbCharacter(tx, actor, receipt, bytes);
				case "tag": case "trait": case "quote": return adoptVndbSemanticObject(tx, actor, receipt, bytes);
			}
		case "musicbrainz":
			if (key.objectType === "release") return adoptMusicBrainzRelease(tx, actor, receipt, bytes);
			if (["recording", "work", "release_group"].includes(key.objectType)) return adoptMusicBrainzObject(tx, actor, receipt, bytes);
			return adoptMusicBrainzSupportingEndpoint(tx, actor, receipt, bytes);
		case "bangumi":
			switch (key.objectType) {
				case "subject": return adoptBangumiSubject(tx, actor, receipt, bytes);
				case "person": case "character": return adoptBangumiEntity(tx, actor, receipt, bytes, "api");
				case "episode": return adoptBangumiProgramEpisode(tx, actor, receipt, bytes, "api");
				case "index": return adoptBangumiIndex(tx, actor, receipt, bytes);
			}
		case "openlibrary": return adoptOpenLibraryRecord(tx, actor, receipt, bytes);
	}
}

/** @internal Select the exact mapper version already pinned by the binding and proposal. */
export function catalogSourcePrincipalWriter(before: NativeSourceSnapshot | null, after: NativeSourceSnapshot,
	mappingVersion: string): CatalogSourceNativeWriter {
	const key = CatalogSourceIntakeKeySchema.parse(after.receipt.key);
	if (before && (before.receipt.key.source !== key.source || before.receipt.key.objectType !== key.objectType || before.receipt.key.externalId !== key.externalId))
		throw new TypeError("Source writer cannot cross principal identities");
	switch (key.source) {
		case "vndb":
			if (key.objectType === "vn") return createVndbVnNativeWriter({ before, after,
				mappingVersion: z.enum(["vndb.vn.2", "vndb.vn.3", "vndb.vn.4"]).parse(mappingVersion) });
			if (key.objectType === "release") return createVndbReleaseNativeWriter({ before, after });
			return createVndbSupportingNativeWriter({ before, after });
		case "musicbrainz":
			if (key.objectType === "release" || ["recording", "work", "release_group"].includes(key.objectType)) {
				if (!before) throw new TypeError("Music core update requires its previous adopted snapshot");
				return key.objectType === "release" ? musicBrainzReleaseNativeWriter(before, after) : musicBrainzObjectNativeWriter(before, after);
			}
			return musicBrainzSupportingNativeWriter(before, after);
		case "bangumi": return createBangumiNativeWriter({ before, after });
		case "openlibrary": return createOpenLibraryNativeWriter({ before, after });
	}
}
