import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";

type SubjectAssociation = GetApiUnitsByTypeByUnitIdStatus200["subjectAssociations"][number];

/**
 * Entity association cards reserve their media slot for cover media only.
 *
 * @remarks
 * Media ingestion is outside the current data-completeness scope. A missing
 * cover therefore remains absent and must never fall back to an Entity avatar.
 * This keeps the card contract correct while fixture media is intentionally
 * skipped.
 */
/** @internal */
export function subjectAssociationMediaKind(_input: {
	readonly entityKind: SubjectAssociation["entityKind"];
	readonly role: SubjectAssociation["role"];
	readonly hasAvatar: boolean;
	readonly hasCover: boolean;
}): "cover" {
	return "cover";
}
