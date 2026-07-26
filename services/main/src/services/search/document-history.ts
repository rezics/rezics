import { and, desc, eq, sql } from "drizzle-orm";
import { parseSearchDocument, type SearchDocument } from "@rezics/filter";

import type { DatabaseTransaction } from "../database";
import {
	revisionContent,
	searchDocumentRevision,
	searchDocumentRevisionHead,
} from "../database/schema";
import { findOrCreateRevisionContent, materializeStoredRevisionContent } from "../history/content";
import { SearchDocumentRevisionConflict } from "./errors";

export const SearchDocumentContentModel = "rezics.search-document.v1" as const;

interface SearchDocumentState {
	readonly version: 1;
	readonly searchDocumentId: string;
	readonly document: SearchDocument;
}

function parseState(searchDocumentId: string, value: unknown): SearchDocumentState {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new TypeError("Invalid SearchDocument checkpoint");
	const state = value as Record<string, unknown>;
	if (state.version !== 1 || state.searchDocumentId !== searchDocumentId)
		throw new TypeError("SearchDocument checkpoint has another identity or version");
	return {
		version: 1,
		searchDocumentId,
		document: parseSearchDocument(state.document),
	};
}

async function lock(tx: DatabaseTransaction, searchDocumentId: string): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`search-document:${searchDocumentId}`}::text, 0))`,
	);
}

async function loadHead(tx: DatabaseTransaction, searchDocumentId: string) {
	const [head] = await tx
		.select({
			revisionId: searchDocumentRevisionHead.revisionId,
			contentId: searchDocumentRevision.contentId,
			model: revisionContent.model,
		})
		.from(searchDocumentRevisionHead)
		.innerJoin(
			searchDocumentRevision,
			eq(searchDocumentRevision.id, searchDocumentRevisionHead.revisionId),
		)
		.innerJoin(revisionContent, eq(revisionContent.id, searchDocumentRevision.contentId))
		.where(eq(searchDocumentRevisionHead.searchDocumentId, searchDocumentId))
		.limit(1);
	if (head && head.model !== SearchDocumentContentModel)
		throw new Error("SearchDocument history uses an unsupported content model");
	return head;
}

async function commit(
	tx: DatabaseTransaction,
	input: {
		readonly searchDocumentId: string;
		readonly expectedRevisionId: string | null;
		readonly actorProfileId?: string | null;
		readonly kind: "create" | "update" | "restore";
		readonly sourceRevisionId?: string;
		readonly message?: string;
		readonly document: SearchDocument;
	},
) {
	const head = await loadHead(tx, input.searchDocumentId);
	if ((head?.revisionId ?? null) !== input.expectedRevisionId)
		throw new SearchDocumentRevisionConflict(head?.revisionId ?? null);
	if ((input.kind === "restore") !== Boolean(input.sourceRevisionId))
		throw new TypeError("Only SearchDocument restore revisions have a source revision");
	const state = parseState(input.searchDocumentId, {
		version: 1,
		searchDocumentId: input.searchDocumentId,
		document: input.document,
	});
	const content = await findOrCreateRevisionContent(tx, {
		model: SearchDocumentContentModel,
		payload: state,
	});
	if (input.kind === "update" && head?.contentId === content.id)
		return { revisionId: head.revisionId, revisionCreated: false as const };
	const [revision] = await tx
		.insert(searchDocumentRevision)
		.values({
			searchDocumentId: input.searchDocumentId,
			parentRevisionId: head?.revisionId ?? null,
			sourceRevisionId: input.sourceRevisionId ?? null,
			contentId: content.id,
			actorProfileId: input.actorProfileId,
			editSummary: input.message,
			kind: input.kind,
		})
		.returning({ id: searchDocumentRevision.id });
	if (!revision) throw new Error("SearchDocument revision insertion returned no id");
	await tx
		.insert(searchDocumentRevisionHead)
		.values({ searchDocumentId: input.searchDocumentId, revisionId: revision.id })
		.onConflictDoUpdate({
			target: searchDocumentRevisionHead.searchDocumentId,
			set: { revisionId: revision.id },
		});
	return { revisionId: revision.id, revisionCreated: true as const };
}

export async function createSearchDocumentHistory(
	tx: DatabaseTransaction,
	input: {
		readonly searchDocumentId: string;
		readonly document: SearchDocument;
		readonly actorProfileId?: string | null;
		readonly message?: string;
	},
) {
	await lock(tx, input.searchDocumentId);
	return commit(tx, { ...input, expectedRevisionId: null, kind: "create" });
}

export async function updateSearchDocumentHistory(
	tx: DatabaseTransaction,
	input: {
		readonly searchDocumentId: string;
		readonly document: SearchDocument;
		readonly baseRevisionId: string;
		readonly actorProfileId?: string | null;
		readonly message?: string;
	},
) {
	await lock(tx, input.searchDocumentId);
	return commit(tx, {
		...input,
		expectedRevisionId: input.baseRevisionId,
		kind: "update",
	});
}

export async function getSearchDocumentRevisionId(
	tx: DatabaseTransaction,
	searchDocumentId: string,
): Promise<string | null> {
	return (await loadHead(tx, searchDocumentId))?.revisionId ?? null;
}

export async function listSearchDocumentRevisions(
	tx: DatabaseTransaction,
	searchDocumentId: string,
	limit = 50,
) {
	return tx
		.select({
			id: searchDocumentRevision.id,
			parentRevisionId: searchDocumentRevision.parentRevisionId,
			sourceRevisionId: searchDocumentRevision.sourceRevisionId,
			actorProfileId: searchDocumentRevision.actorProfileId,
			kind: searchDocumentRevision.kind,
			editSummary: searchDocumentRevision.editSummary,
			createdAt: searchDocumentRevision.createdAt,
		})
		.from(searchDocumentRevision)
		.where(eq(searchDocumentRevision.searchDocumentId, searchDocumentId))
		.orderBy(desc(searchDocumentRevision.createdAt), desc(searchDocumentRevision.id))
		.limit(limit);
}

export async function getSearchDocumentRevisionState(
	tx: DatabaseTransaction,
	input: { readonly searchDocumentId: string; readonly revisionId: string },
): Promise<SearchDocumentState> {
	const [revision] = await tx
		.select({ contentId: searchDocumentRevision.contentId })
		.from(searchDocumentRevision)
		.where(
			and(
				eq(searchDocumentRevision.id, input.revisionId),
				eq(searchDocumentRevision.searchDocumentId, input.searchDocumentId),
			),
		)
		.limit(1);
	if (!revision)
		throw new SearchDocumentRevisionConflict(
			await getSearchDocumentRevisionId(tx, input.searchDocumentId),
		);
	const content = await materializeStoredRevisionContent(tx, revision.contentId, {
		maxDeltaDepth: 0,
		applyDelta: (model) => {
			throw new Error(`Unsupported SearchDocument delta model ${model}`);
		},
	});
	if (content.model !== SearchDocumentContentModel)
		throw new Error("SearchDocument revision uses an unsupported content model");
	return parseState(input.searchDocumentId, content.payload);
}

export async function restoreSearchDocumentHistory(
	tx: DatabaseTransaction,
	input: {
		readonly searchDocumentId: string;
		readonly sourceRevisionId: string;
		readonly baseRevisionId: string;
		readonly actorProfileId?: string | null;
		readonly message?: string;
	},
) {
	await lock(tx, input.searchDocumentId);
	const head = await loadHead(tx, input.searchDocumentId);
	if ((head?.revisionId ?? null) !== input.baseRevisionId)
		throw new SearchDocumentRevisionConflict(head?.revisionId ?? null);
	const state = await getSearchDocumentRevisionState(tx, {
		searchDocumentId: input.searchDocumentId,
		revisionId: input.sourceRevisionId,
	});
	return commit(tx, {
		searchDocumentId: input.searchDocumentId,
		expectedRevisionId: input.baseRevisionId,
		actorProfileId: input.actorProfileId,
		kind: "restore",
		sourceRevisionId: input.sourceRevisionId,
		message: input.message,
		document: state.document,
	});
}
