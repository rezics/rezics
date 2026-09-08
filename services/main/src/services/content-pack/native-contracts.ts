import type { z } from "zod";
import type { CatalogOwner } from "@rezics/reference";
import type { CreateCatalogResourceSchema } from "../catalog/resource-contracts";

/** The pack's declared owner and shape must agree with the complete native construction command. */
export function nativePackReference(value: z.infer<typeof CreateCatalogResourceSchema>): {
	owner: CatalogOwner;
	shape: string;
} {
	switch (value.kind) {
		case "publishing_work":
			return { owner: "publishing", shape: "work" };
		case "text_version":
			return { owner: "publishing", shape: "text_version" };
		case "publication":
			return { owner: "publishing", shape: "publication" };
		case "serialization":
			return { owner: "publishing", shape: "serialization" };
		case "musical_work":
			return { owner: "music", shape: "work" };
		case "recording":
			return { owner: "music", shape: "recording" };
		case "release_group":
			return { owner: "music", shape: "release_group" };
		case "music_release":
			return { owner: "music", shape: "release" };
		case "software_content":
			return { owner: "software", shape: "content" };
		case "software_version":
			return { owner: "software", shape: "version" };
		case "software_release":
			return { owner: "software", shape: "release" };
		case "program":
			return { owner: "program", shape: value.structure.shape };
		case "entity":
			return { owner: "entity", shape: value.shape };
		case "reference":
			return { owner: "reference", shape: value.profile.shape };
		case "grouping":
			return { owner: "grouping", shape: "grouping" };
		case "distribution":
			return { owner: "distribution", shape: "package" };
	}
}
/** Only semantic resource-reference fields affect ordering; titles and identifiers are never guessed as links. */
export function nativePackDependencies(
	value: z.infer<typeof CreateCatalogResourceSchema>,
): readonly string[] {
	switch (value.kind) {
		case "serialization":
			return value.textVersionId ? [value.textVersionId] : [];
		case "software_version":
			return [value.content.id];
		case "music_release":
			return value.releaseGroup ? [value.releaseGroup.id] : [];
		case "entity":
			return [value.profile.areaId, value.profile.beginAreaId, value.profile.endAreaId].filter(
				(id): id is string => id !== null,
			);
		case "reference":
			return value.profile.shape === "place" && value.profile.areaId
				? [value.profile.areaId]
				: value.profile.shape === "event" && value.profile.placeId
					? [value.profile.placeId]
					: [];
		case "program": {
			const structure = value.structure;
			if (structure.shape === "program") return [];
			return [
				structure.fields.programId,
				...(structure.shape === "episode" ? [structure.fields.seasonId] : []),
			].filter((id): id is string => id !== null);
		}
		default:
			return [];
	}
}
