import { createHash } from "node:crypto";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { isPortableTextDocument, type PortableTextDocument } from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";
import { measurePortableText, PortableTextMetricAlgorithmVersion } from "@rezics/portable-text";

import type { DatabaseExecutor, DatabaseTransaction } from "../database";
import {
	contentStructure,
	contentStructureNode,
	post,
	unit,
	unitLocalization,
	unitLocalizationContentMetric,
} from "../database/schema";
import { toSafeInteger } from "../database/integer";
import { canonicalRevisionJson } from "../history/content";

export type ContentMetricCounts = {
	readonly wordCount: number;
	readonly characterCount: number;
};

export type LocalizedContentMetric = ContentMetricCounts & {
	readonly language: ContentLanguage;
};

type StoredContentMetric = LocalizedContentMetric & {
	readonly algorithmVersion: number;
	readonly sourceSha256: string;
};

export function derivePortableTextContentMetric(
	document: PortableTextDocument,
	language: ContentLanguage,
): StoredContentMetric {
	const counts = measurePortableText(document.content, language);
	const sourceSha256 = createHash("sha256").update(canonicalRevisionJson(document)).digest("hex");
	return {
		language,
		...counts,
		algorithmVersion: PortableTextMetricAlgorithmVersion,
		sourceSha256,
	};
}

function sameStoredMetric(left: StoredContentMetric, right: StoredContentMetric): boolean {
	return (
		left.language === right.language &&
		left.wordCount === right.wordCount &&
		left.characterCount === right.characterCount &&
		left.algorithmVersion === right.algorithmVersion &&
		left.sourceSha256 === right.sourceSha256
	);
}

/**
 * Rebuilds all localized Portable Text metrics for one Unit.
 *
 * Unit History is the common transactional boundary for semantic Unit writes,
 * so callers run this after the live localization state is valid and before
 * the transaction commits. Non-Portable-Text content has no metric row.
 */
export async function syncUnitLocalizationContentMetrics(
	tx: DatabaseTransaction,
	unitId: string,
): Promise<void> {
	const localizations = await tx
		.select({
			language: unitLocalization.language,
			content: unitLocalization.content,
		})
		.from(unitLocalization)
		.where(eq(unitLocalization.unitId, unitId))
		.orderBy(unitLocalization.language);
	const storedMetrics = await tx
		.select({
			language: unitLocalizationContentMetric.language,
			wordCount: unitLocalizationContentMetric.wordCount,
			characterCount: unitLocalizationContentMetric.characterCount,
			algorithmVersion: unitLocalizationContentMetric.algorithmVersion,
			sourceSha256: unitLocalizationContentMetric.sourceSha256,
		})
		.from(unitLocalizationContentMetric)
		.where(eq(unitLocalizationContentMetric.unitId, unitId));
	const storedByLanguage = new Map(
		storedMetrics.map((metric) => [metric.language, metric] as const),
	);
	const expectedMetrics = localizations.flatMap((localization): StoredContentMetric[] =>
		isPortableTextDocument(localization.content)
			? [derivePortableTextContentMetric(localization.content, localization.language)]
			: [],
	);
	const expectedLanguages = new Set(expectedMetrics.map((metric) => metric.language));

	for (const metric of expectedMetrics) {
		const stored = storedByLanguage.get(metric.language);
		if (stored && sameStoredMetric(stored, metric)) continue;
		await tx
			.insert(unitLocalizationContentMetric)
			.values({ unitId, ...metric })
			.onConflictDoUpdate({
				target: [
					unitLocalizationContentMetric.unitId,
					unitLocalizationContentMetric.language,
				],
				set: {
					wordCount: metric.wordCount,
					characterCount: metric.characterCount,
					algorithmVersion: metric.algorithmVersion,
					sourceSha256: metric.sourceSha256,
					updatedAt: new Date(),
				},
			});
	}

	for (const stored of storedMetrics) {
		if (expectedLanguages.has(stored.language)) continue;
		await tx
			.delete(unitLocalizationContentMetric)
			.where(
				and(
					eq(unitLocalizationContentMetric.unitId, unitId),
					eq(unitLocalizationContentMetric.language, stored.language),
				),
			);
	}
}

export async function getUnitLocalizationContentMetric(
	executor: DatabaseExecutor,
	unitId: string,
	language: ContentLanguage,
): Promise<ContentMetricCounts | null> {
	const [metric] = await executor
		.select({
			wordCount: unitLocalizationContentMetric.wordCount,
			characterCount: unitLocalizationContentMetric.characterCount,
		})
		.from(unitLocalizationContentMetric)
		.where(
			and(
				eq(unitLocalizationContentMetric.unitId, unitId),
				eq(unitLocalizationContentMetric.language, language),
			),
		)
		.limit(1);
	return metric ?? null;
}

/**
 * Sums only currently public, published chapter occurrences for a hosted Book.
 * Editorial `book.wordCount` is intentionally unrelated to this projection.
 */
export async function listPublishedBookContentMetrics(
	executor: DatabaseExecutor,
	bookId: string,
): Promise<(LocalizedContentMetric & { readonly chapterCount: number })[]> {
	const rows = await executor
		.select({
			language: unitLocalizationContentMetric.language,
			chapterCount: sql<unknown>`count(*)`,
			wordCount: sql<unknown>`sum(${unitLocalizationContentMetric.wordCount})`,
			characterCount: sql<unknown>`sum(${unitLocalizationContentMetric.characterCount})`,
		})
		.from(contentStructureNode)
		.innerJoin(
			contentStructure,
			and(
				eq(contentStructure.id, contentStructureNode.structureId),
				eq(contentStructure.ownerUnitId, contentStructureNode.ownerUnitId),
			),
		)
		.innerJoin(post, eq(post.id, contentStructureNode.contentUnitId))
		.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
		.innerJoin(
			unitLocalization,
			eq(unitLocalization.unitId, contentStructureNode.contentUnitId),
		)
		.innerJoin(
			unitLocalizationContentMetric,
			and(
				eq(unitLocalizationContentMetric.unitId, contentStructureNode.contentUnitId),
				eq(unitLocalizationContentMetric.language, unitLocalization.language),
			),
		)
		.where(
			and(
				eq(contentStructure.ownerUnitId, bookId),
				eq(contentStructure.kind, "book.contents"),
				isNull(contentStructure.deletedAt),
				isNull(contentStructureNode.deletedAt),
				eq(post.kind, "chapter"),
				isNull(unit.deletedAt),
				eq(unit.status, "published"),
				inArray(unit.visibility, ["public", "unlisted"]),
				eq(unitLocalization.contentStatus, "published"),
			),
		)
		.groupBy(unitLocalizationContentMetric.language)
		.orderBy(unitLocalizationContentMetric.language);
	return rows.map((row) => ({
		language: row.language,
		chapterCount: toSafeInteger(row.chapterCount, `${row.language} chapter metric count`),
		wordCount: toSafeInteger(row.wordCount, `${row.language} chapter word count`),
		characterCount: toSafeInteger(
			row.characterCount,
			`${row.language} chapter character count`,
		),
	}));
}
