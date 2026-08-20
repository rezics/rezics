import {
	type ContentLanguageSupport,
	ContentLanguageSupportValidationError,
	normalizeContentLanguageSupport,
} from "@rezics/content-language";
import { eq, inArray, sql } from "drizzle-orm";

import { type DatabaseTransaction, database } from "../database";
import {
	type ContentLanguageSupportUnitKind,
	ContentLanguageSupportUnitKindValues,
	type UnitKind,
	unitContentLanguageSupport,
} from "../database/schema";
import { UnitContentLanguageSupportInvalid } from "./errors";

const ContentLanguageSupportUnitKindSet: ReadonlySet<UnitKind> = new Set(
	ContentLanguageSupportUnitKindValues,
);
const EmptyContentLanguageSupport: ContentLanguageSupport = Object.freeze([]);
const MaximumBatchUnitCount = 100;

/** Prevents an identical authoritative value from creating heap/index/WAL churn. */
export const unitContentLanguageSupportUpsertChangeCondition = sql`
	${unitContentLanguageSupport.value} is distinct from excluded.value
	or ${unitContentLanguageSupport.unitKind} is distinct from excluded.unit_kind
`;

/** Copies the immutable domain value into the mutable JSON shape used by TypeBox. */
export function presentContentLanguageSupport(value: ContentLanguageSupport) {
	return value.map((entry) => ({
		languageTag: entry.languageTag,
		...(entry.channels ? { channels: [...entry.channels] } : {}),
	}));
}

export function isContentLanguageSupportUnitKind(
	kind: UnitKind,
): kind is ContentLanguageSupportUnitKind {
	return ContentLanguageSupportUnitKindSet.has(kind);
}

export function normalizeContentLanguageSupportInput(value: unknown): ContentLanguageSupport {
	try {
		return normalizeContentLanguageSupport(value);
	} catch (error) {
		if (error instanceof ContentLanguageSupportValidationError)
			throw new UnitContentLanguageSupportInvalid(error.path, error.message);
		throw error;
	}
}

function parseStoredContentLanguageSupport(value: unknown): ContentLanguageSupport {
	try {
		return normalizeContentLanguageSupport(value);
	} catch (error) {
		throw new Error("Invalid persisted Unit content language support", { cause: error });
	}
}

export async function getUnitContentLanguageSupport(
	unitId: string,
): Promise<ContentLanguageSupport> {
	const [row] = await database
		.select({ value: unitContentLanguageSupport.value })
		.from(unitContentLanguageSupport)
		.where(eq(unitContentLanguageSupport.unitId, unitId))
		.limit(1);
	return row ? parseStoredContentLanguageSupport(row.value) : EmptyContentLanguageSupport;
}

export async function getUnitContentLanguageSupportByUnitIds(
	unitIds: readonly string[],
): Promise<ReadonlyMap<string, ContentLanguageSupport>> {
	if (unitIds.length === 0) return new Map();
	if (unitIds.length > MaximumBatchUnitCount)
		throw new RangeError(
			`Content language support batch cannot exceed ${MaximumBatchUnitCount} Units`,
		);
	const rows = await database
		.select({ unitId: unitContentLanguageSupport.unitId, value: unitContentLanguageSupport.value })
		.from(unitContentLanguageSupport)
		.where(inArray(unitContentLanguageSupport.unitId, unitIds));
	return new Map(
		rows.map((row) => [row.unitId, parseStoredContentLanguageSupport(row.value)] as const),
	);
}

/** Replaces the one authoritative field; an empty field is represented by no row. */
export async function replaceUnitContentLanguageSupport(
	tx: DatabaseTransaction,
	unitId: string,
	unitKind: UnitKind,
	value: unknown,
): Promise<ContentLanguageSupport> {
	if (!isContentLanguageSupportUnitKind(unitKind))
		throw new UnitContentLanguageSupportInvalid(
			"/",
			`Unit kind ${unitKind} does not support this field`,
		);
	const normalized = normalizeContentLanguageSupportInput(value);
	if (normalized.length === 0) {
		await tx
			.delete(unitContentLanguageSupport)
			.where(eq(unitContentLanguageSupport.unitId, unitId));
		return normalized;
	}
	await tx
		.insert(unitContentLanguageSupport)
		.values({ unitId, unitKind, value: normalized })
		.onConflictDoUpdate({
			target: unitContentLanguageSupport.unitId,
			set: { unitKind, value: normalized, updatedAt: new Date() },
			setWhere: unitContentLanguageSupportUpsertChangeCondition,
		});
	return normalized;
}
