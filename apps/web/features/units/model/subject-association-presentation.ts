import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";

type SubjectAssociation = GetApiUnitsByTypeByUnitIdStatus200["subjectAssociations"][number];

const CharacterAssociationRoles = ["primary_character", "featured_character", "appears"] as const;

/**
 * Controls whether subject-association cards may substitute another media kind.
 *
 * @remarks
 * Fallback is intentionally disabled because avatar and cover combinations
 * cannot currently preserve a consistent card presentation across Entity
 * kinds. While disabled, every Entity keeps the canonical cover slot even
 * when its source is absent. Re-enable substitution only after one shared
 * SharkUI fallback contract owns that visual behavior.
 */
const SubjectAssociationMediaFallbackPolicy = { enabled: false } as const;

type SubjectAssociationMediaKind = "avatar" | "cover";

/** @internal */
export function subjectAssociationMediaKind(input: {
	readonly entityKind: SubjectAssociation["entityKind"];
	readonly role: SubjectAssociation["role"];
	readonly hasAvatar: boolean;
	readonly hasCover: boolean;
}): SubjectAssociationMediaKind {
	if (!SubjectAssociationMediaFallbackPolicy.enabled) return "cover";
	if (input.hasCover) return "cover";
	return fallbackSubjectAssociationMediaKind(input);
}

function fallbackSubjectAssociationMediaKind(
	input: Parameters<typeof subjectAssociationMediaKind>[0],
): SubjectAssociationMediaKind {
	const characterRole =
		input.entityKind === "character" &&
		CharacterAssociationRoles.some((role) => role === input.role);
	if (characterRole && input.hasCover) return "cover";
	if (!characterRole && !input.hasAvatar && input.hasCover) return "cover";
	return "avatar";
}
