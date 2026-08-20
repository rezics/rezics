import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";

type SubjectAssociation = GetApiUnitsByTypeByUnitIdStatus200["subjectAssociations"][number];

const CharacterAssociationRoles = ["primary_character", "featured_character", "appears"] as const;

export function subjectAssociationMediaKind(input: {
	readonly entityKind: SubjectAssociation["entityKind"];
	readonly role: SubjectAssociation["role"];
	readonly hasAvatar: boolean;
	readonly hasCover: boolean;
}): "avatar" | "cover" {
	const characterRole =
		input.entityKind === "character" &&
		CharacterAssociationRoles.some((role) => role === input.role);
	if (characterRole && input.hasCover) return "cover";
	if (!characterRole && !input.hasAvatar && input.hasCover) return "cover";
	return "avatar";
}
