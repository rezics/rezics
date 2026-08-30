import { t } from "elysia";

import { ContentLanguage, Uuid } from "../api/schema";
import { MaximumSubjectAssociationsPageSize } from "../database/schema/contract-values";
import { FractionalPositionStorageMaximumBytes, isFractionalPosition } from "../ordering/position";
import { parseJsonCursor } from "../pagination";
import { InvalidPaginationCursor } from "../pagination/errors";

const SubjectAssociationListCursor = t.Object(
	{
		v: t.Literal(1),
		unitId: Uuid,
		localizationLanguages: t.Array(ContentLanguage, { uniqueItems: true, maxItems: 50 }),
		limit: t.Integer({ minimum: 1, maximum: MaximumSubjectAssociationsPageSize }),
		position: t.String({ minLength: 1, maxLength: FractionalPositionStorageMaximumBytes }),
		id: Uuid,
	},
	{ additionalProperties: false },
);

export interface SubjectAssociationCursorContext {
	readonly unitId: string;
	readonly localizationLanguages: readonly string[];
	readonly limit: number;
}

export interface SubjectAssociationCursorBoundary {
	readonly position: string;
	readonly id: string;
}

function equalOrderedValues(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function decodeSubjectAssociationCursor(
	value: string | undefined,
	context: SubjectAssociationCursorContext,
): SubjectAssociationCursorBoundary | undefined {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, SubjectAssociationListCursor);
		if (
			cursor.unitId !== context.unitId ||
			cursor.limit !== context.limit ||
			!equalOrderedValues(cursor.localizationLanguages, context.localizationLanguages) ||
			!isFractionalPosition(cursor.position)
		)
			throw new InvalidPaginationCursor();
		return { position: cursor.position, id: cursor.id };
	} catch {
		throw new InvalidPaginationCursor();
	}
}

export function encodeSubjectAssociationCursor(
	boundary: SubjectAssociationCursorBoundary,
	context: SubjectAssociationCursorContext,
): string {
	return Buffer.from(
		JSON.stringify({
			v: 1,
			unitId: context.unitId,
			localizationLanguages: context.localizationLanguages,
			limit: context.limit,
			position: boundary.position,
			id: boundary.id,
		}),
	).toString("base64url");
}
