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
	readonly boundary: ProgressSearchBoundary;
	readonly consumed: number;
	readonly pageSize: number;
	readonly requestHash: string;
	readonly total: number;
}

export interface ProgressSearchBoundary {
	readonly sortValue: string | null;
	readonly unitId: string;
}

export interface ResolvedProgressSearchRequest {
	readonly boundary?: ProgressSearchBoundary;
	readonly consumed: number;
	readonly pageSize: number;
	readonly query: string;
	readonly requestHash: string;
	readonly sort: ProgressSearchSort;
	readonly total?: number;
}

export function getProgressSearchDefinition() {
	return resolveSearchDocument(ProgressSearchDocument, true);
}

function isProgressSearchSort(value: string): value is ProgressSearchSort {
	return ProgressSearchSortSet.has(value);
}

function decodeProgressSearchCursor(value: string): ProgressSearchCursor {
	if (!value.startsWith("s1_")) throw new InvalidSearch("Invalid progress Search cursor");
	let parsed: unknown;
	try {
		parsed = JSON.parse(Buffer.from(value.slice(3), "base64url").toString("utf8"));
	} catch {
		throw new InvalidSearch("Invalid progress Search cursor");
	}
	if (!parsed || typeof parsed !== "object")
		throw new InvalidSearch("Invalid progress Search cursor");
	const cursor = parsed as Record<string, unknown>;
	const boundary = cursor.boundary;
	if (
		cursor.version !== 1 ||
		!boundary ||
		typeof boundary !== "object" ||
		!("sortValue" in boundary) ||
		!("unitId" in boundary) ||
		(boundary.sortValue !== null && typeof boundary.sortValue !== "string") ||
		typeof boundary.unitId !== "string" ||
		!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
			boundary.unitId,
		) ||
		typeof cursor.consumed !== "number" ||
		!Number.isSafeInteger(cursor.consumed) ||
		cursor.consumed < 1 ||
		typeof cursor.pageSize !== "number" ||
		!Number.isSafeInteger(cursor.pageSize) ||
		cursor.pageSize < 1 ||
		typeof cursor.requestHash !== "string" ||
		!/^[0-9a-f]{64}$/.test(cursor.requestHash) ||
		typeof cursor.total !== "number" ||
		!Number.isSafeInteger(cursor.total) ||
		cursor.total < cursor.consumed
	)
		throw new InvalidSearch("Invalid progress Search cursor");
	return {
		version: 1,
		boundary: { sortValue: boundary.sortValue, unitId: boundary.unitId },
		consumed: cursor.consumed,
		pageSize: cursor.pageSize,
		requestHash: cursor.requestHash,
		total: cursor.total,
	};
}

export function createProgressSearchCursor(
	request: Pick<ResolvedProgressSearchRequest, "pageSize" | "requestHash">,
	input: {
		readonly boundary: ProgressSearchBoundary;
		readonly consumed: number;
		readonly total: number;
	},
): string {
	const cursor: ProgressSearchCursor = {
		version: 1,
		boundary: input.boundary,
		consumed: input.consumed,
		pageSize: request.pageSize,
		requestHash: request.requestHash,
		total: input.total,
	};
	return `s1_${Buffer.from(JSON.stringify(cursor)).toString("base64url")}`;
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
			cursor.consumed + pageSize > ProgressSearchDocument.results.maxResultWindow ||
			(sort.startsWith("progressLastSeenAt:") &&
				(cursor.boundary.sortValue === null ||
					!Number.isFinite(Date.parse(cursor.boundary.sortValue)))))
	)
		throw new InvalidSearch("Progress Search cursor does not match this request");

	return {
		query,
		sort,
		pageSize,
		consumed: cursor?.consumed ?? 0,
		...(cursor ? { boundary: cursor.boundary, total: cursor.total } : {}),
		requestHash,
	};
}
