import { parseSharedSearchQueryDocument, type SharedSearchQueryDocument } from "@rezics/filter";
import { eq } from "drizzle-orm";

import type { DatabaseExecutor } from "../database";
import { sharedSearchQuery } from "../database/schema";
import { InvalidSearch } from "./errors";
import { compileSearchFeatureInput, createDefaultSearchDocument } from "./templates";

export interface SharedSearchQueryProjection {
	readonly id: string;
	readonly document: SharedSearchQueryDocument;
	readonly createdAt: Date;
}

/**
 * Proves both the stored document shape and the template-specific control
 * semantics. Presentation selections never participate in this proof.
 */
function validateDocument(value: unknown): SharedSearchQueryDocument {
	let document: SharedSearchQueryDocument;
	try {
		document = parseSharedSearchQueryDocument(value);
	} catch (cause) {
		throw new InvalidSearch(
			cause instanceof Error ? cause.message : "Invalid shared Search query document",
		);
	}
	compileSearchFeatureInput(
		{
			document: createDefaultSearchDocument(document.template),
			contexts: [],
			injections: [],
			state: document.state,
		},
		"search",
	);
	return document;
}

export async function createSharedSearchQuery(
	database: DatabaseExecutor,
	input: {
		readonly document: unknown;
		readonly createdByProfileId: string;
	},
): Promise<SharedSearchQueryProjection> {
	const document = validateDocument(input.document);
	const [created] = await database
		.insert(sharedSearchQuery)
		.values({
			document,
			createdByProfileId: input.createdByProfileId,
		})
		.returning({
			id: sharedSearchQuery.id,
			document: sharedSearchQuery.document,
			createdAt: sharedSearchQuery.createdAt,
		});
	if (!created) throw new Error("Shared Search query insertion returned no row");
	return { ...created, document: validateDocument(created.document) };
}

export async function getSharedSearchQuery(
	database: DatabaseExecutor,
	id: string,
): Promise<SharedSearchQueryProjection | null> {
	const [record] = await database
		.select({
			id: sharedSearchQuery.id,
			document: sharedSearchQuery.document,
			createdAt: sharedSearchQuery.createdAt,
		})
		.from(sharedSearchQuery)
		.where(eq(sharedSearchQuery.id, id))
		.limit(1);
	return record ? { ...record, document: validateDocument(record.document) } : null;
}
