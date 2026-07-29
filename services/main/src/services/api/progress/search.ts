import { createHash } from "node:crypto";
import {
	defaultSearchSort,
	parseSearchFeatureInput,
	searchSortConfiguration,
	unitFilterSearchQuery,
} from "@rezics/filter";

import { InvalidSearch } from "../../search/errors";
import {
	createDefaultSearchDocument,
	ProgressSearchSorts,
	resolveSearchDocument,
	type ProgressSearchSort,
} from "../../search/templates";

const ProgressSearchDocument = createDefaultSearchDocument("progress");
const ProgressSearchSortSet: ReadonlySet<string> = new Set(ProgressSearchSorts);

interface ProgressSearchCursor {
	readonly version: 1;
	readonly offset: number;
	readonly pageSize: number;
	readonly requestHash: string;
}

export interface ResolvedProgressSearchRequest {
	readonly offset: number;
	readonly pageSize: number;
	readonly query: string;
	readonly requestHash: string;
	readonly sort: ProgressSearchSort;
}

export function getProgressSearchDefinition() {
	return resolveSearchDocument(ProgressSearchDocument, true);
}

function isProgressSearchSort(value: string): value is ProgressSearchSort {
	return ProgressSearchSortSet.has(value);
}

function decodeProgressSearchCursor(value: string): ProgressSearchCursor {
	if (!value.startsWith("s2_")) throw new InvalidSearch("Invalid progress Search cursor");
	let parsed: unknown;
	try {
		parsed = JSON.parse(Buffer.from(value.slice(3), "base64url").toString("utf8"));
	} catch {
		throw new InvalidSearch("Invalid progress Search cursor");
	}
	if (!parsed || typeof parsed !== "object")
		throw new InvalidSearch("Invalid progress Search cursor");
	const cursor = parsed as Record<string, unknown>;
	if (
		cursor.version !== 1 ||
		typeof cursor.offset !== "number" ||
		!Number.isSafeInteger(cursor.offset) ||
		cursor.offset < 0 ||
		typeof cursor.pageSize !== "number" ||
		!Number.isSafeInteger(cursor.pageSize) ||
		cursor.pageSize < 1 ||
		typeof cursor.requestHash !== "string" ||
		!/^[0-9a-f]{64}$/.test(cursor.requestHash)
	)
		throw new InvalidSearch("Invalid progress Search cursor");
	return {
		version: 1,
		offset: cursor.offset,
		pageSize: cursor.pageSize,
		requestHash: cursor.requestHash,
	};
}

export function createProgressSearchCursor(
	request: Pick<ResolvedProgressSearchRequest, "pageSize" | "requestHash">,
	offset: number,
): string {
	const cursor: ProgressSearchCursor = {
		version: 1,
		offset,
		pageSize: request.pageSize,
		requestHash: request.requestHash,
	};
	return `s2_${Buffer.from(JSON.stringify(cursor)).toString("base64url")}`;
}

export function resolveProgressSearchRequest(value: unknown): ResolvedProgressSearchRequest {
	let input: ReturnType<typeof parseSearchFeatureInput>;
	try {
		const body =
			value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
		input = parseSearchFeatureInput({
			document: ProgressSearchDocument,
			contexts: [],
			injections: body?.injections,
			state: body?.state,
		});
	} catch (cause) {
		throw new InvalidSearch(
			cause instanceof Error ? cause.message : "Invalid progress Search request",
		);
	}
	if (input.injections.length > 0 || input.state.expression)
		throw new InvalidSearch("Progress Search does not accept injected or advanced filters");
	if (input.state.filter?.where)
		throw new InvalidSearch("Progress Search scope is established by the server");

	const query = unitFilterSearchQuery(input.state.filter).trim();
	const configuration = searchSortConfiguration(ProgressSearchDocument, "search");
	const sort = input.state.sort ?? defaultSearchSort(configuration, query);
	if (!isProgressSearchSort(sort) || !configuration.options.includes(sort))
		throw new InvalidSearch("Progress Search sort is unavailable");
	const pageSize = input.state.pageSize ?? ProgressSearchDocument.results.pageSize;
	if (pageSize > ProgressSearchDocument.results.maxPageSize)
		throw new InvalidSearch("Progress Search page size exceeds its configured maximum");
	const requestHash = createHash("sha256")
		.update(JSON.stringify({ query, sort, pageSize }))
		.digest("hex");
	const cursor = input.state.cursor ? decodeProgressSearchCursor(input.state.cursor) : undefined;
	if (
		cursor &&
		(cursor.requestHash !== requestHash ||
			cursor.pageSize !== pageSize ||
			cursor.offset + pageSize > ProgressSearchDocument.results.maxResultWindow)
	)
		throw new InvalidSearch("Progress Search cursor does not match this request");

	return {
		query,
		sort,
		pageSize,
		offset: cursor?.offset ?? 0,
		requestHash,
	};
}
