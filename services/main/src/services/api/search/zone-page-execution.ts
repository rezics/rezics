import type { StaticDecode } from "typebox";
import {
	createZoneBlockExecutionPlan,
	DockDocument,
	encodeBlockPath,
	MaxZoneEagerBlockExecutions,
	parseDocument,
	type SearchFeatureSource,
	type BlockPath,
	type ZoneBlockExecutionDescriptor,
	type ZoneBlockExecutionPlan,
	type ZoneBlockExecutionSurface,
	type ZoneSkippedBlockExecutionDescriptor,
} from "@rezics/block";
import { parseSearchFeatureState, type SearchFeatureState } from "@rezics/filter";
import type { ContentLanguage } from "@rezics/i18n";
import { getActiveObservability } from "@rezics/observability";
import { and, eq, isNull } from "drizzle-orm";

import type { Authorization } from "../../authorization";
import { env } from "../../config";
import { database, withDatabaseTransactionDeadline } from "../../database";
import { unitDock } from "../../database/schema";
import { CollectionNotFound } from "../collections/errors";
import { getCollectionContent } from "../collections/service";
import { InvalidSearch, SearchUnavailable } from "../../search/errors";
import type { PersistedSortUnavailableAdvisory } from "../../search/filter-document";
import { withSearchStatementTimeout } from "../../search/statement-timeout";
import { UnitNotFound } from "../../units/errors";
import type { UnitPresentation } from "../../units/attribution";
import { getZonePageUnitById } from "../../zones/pages";
import { ZonePageNotFound } from "../domain-extensions/errors";
import type { ZonePageAggregateExecutionEntry, ZonePageAggregateExecutionResult } from "./schema";

const AggregateExecutionConcurrency = 4;
const AggregateBlockDeadlineMilliseconds = 2_000;
const AggregateStatementTimeoutMilliseconds = 1_900;
const AggregateBlockItemLimit = 20;
const AggregateDatabasePoolReservedConnections = 2;
const AggregateServiceConcurrency = Math.max(
	1,
	env.DATABASE_POOL_MAX - AggregateDatabasePoolReservedConnections,
);
let activeAggregateExecutions = 0;
const { logger } = getActiveObservability();

interface BlockExecutionRequest {
	readonly path: BlockPath;
	readonly selectionSeed?: string;
	readonly state?: unknown;
}

export interface ZonePageExecutionSurface {
	readonly page: NonNullable<Awaited<ReturnType<typeof getZonePageUnitById>>>;
	readonly dock?: ReturnType<typeof parseDocument<typeof DockDocument>>;
	readonly plan: ZoneBlockExecutionPlan;
}

export interface ZoneSearchExecutionResponse {
	readonly hidden?: true;
	readonly selected?: UnitPresentation;
	readonly selectionSeed?: string;
	readonly nextCursor?: string;
	readonly advisory?: PersistedSortUnavailableAdvisory;
	readonly facets?: readonly {
		readonly controlKey?: string;
		readonly field: string;
		readonly options: readonly {
			readonly value: string;
			readonly count: { readonly kind: "exact" | "lower-bound"; readonly value: number };
		}[];
	}[];
	readonly groups: readonly {
		readonly hits: readonly StaticDecode<typeof import("../schema/response").SearchHit>[];
		readonly total: { readonly kind: "exact" | "lower-bound"; readonly value: number };
	}[];
}

export interface ZoneFeedExecutionResponse {
	readonly hidden?: true;
	readonly selected?: UnitPresentation;
	readonly selectionSeed?: string;
	readonly items: readonly (
		| StaticDecode<typeof import("../schema/response").FeedUnitItemResponse>
		| StaticDecode<typeof import("../schema/response").FeedPostItemResponse>
	)[];
	readonly nextCursor?: string;
	readonly advisory?: PersistedSortUnavailableAdvisory;
	readonly facets?: ZoneSearchExecutionResponse["facets"];
	readonly total: { readonly kind: "exact" | "lower-bound"; readonly value: number };
}

export interface ZonePageAggregateExecutors {
	readonly executeSearch: (input: {
		readonly descriptor: ZoneBlockExecutionDescriptor;
		readonly document:
			| ZonePageExecutionSurface["page"]["document"]
			| NonNullable<ZonePageExecutionSurface["dock"]>;
		readonly source: SearchFeatureSource;
		readonly state: SearchFeatureState;
		readonly selectionSeed?: string;
		readonly localizationLanguages: readonly ContentLanguage[];
	}) => Promise<ZoneSearchExecutionResponse>;
	readonly executeFeed: (input: {
		readonly descriptor: ZoneBlockExecutionDescriptor;
		readonly document:
			| ZonePageExecutionSurface["page"]["document"]
			| NonNullable<ZonePageExecutionSurface["dock"]>;
		readonly state: SearchFeatureState;
		readonly selectionSeed?: string;
		readonly localizationLanguages: readonly ContentLanguage[];
	}) => Promise<ZoneFeedExecutionResponse>;
}

/** Loads the Page revision and optional Dock from one repeatable-read snapshot. */
export async function loadZonePageExecutionSurface(input: {
	readonly zoneId: string;
	readonly pageId: string;
	readonly includeDock: boolean;
	readonly localizationLanguages: readonly ContentLanguage[];
}): Promise<ZonePageExecutionSurface> {
	const loaded = await database.transaction(
		async (tx) => {
			const page = await getZonePageUnitById(
				tx,
				input.zoneId,
				input.pageId,
				input.localizationLanguages,
			);
			if (!page) throw new ZonePageNotFound();
			if (!input.includeDock) return { page };
			const [record] = await tx
				.select({ document: unitDock.document })
				.from(unitDock)
				.where(
					and(
						eq(unitDock.unitId, input.zoneId),
						eq(unitDock.kind, "main"),
						isNull(unitDock.deletedAt),
					),
				)
				.limit(1);
			return {
				page,
				...(record ? { dock: parseDocument(DockDocument, record.document) } : {}),
			};
		},
		{ isolationLevel: "repeatable read", accessMode: "read only" },
	);
	return {
		...loaded,
		plan: createZoneBlockExecutionPlan({
			page: loaded.page.document,
			...(loaded.dock ? { dock: loaded.dock } : {}),
		}),
	};
}

export function selectZonePageBlockExecutions(
	plan: ZoneBlockExecutionPlan,
	requests: {
		readonly page?: readonly BlockExecutionRequest[];
		readonly dock?: readonly BlockExecutionRequest[];
	},
): {
	readonly selected: readonly {
		readonly descriptor: ZoneBlockExecutionDescriptor;
		readonly selectionSeed?: string;
		readonly state: SearchFeatureState;
	}[];
	readonly skipped: readonly ZoneSkippedBlockExecutionDescriptor[];
} {
	const explicit = requests.page !== undefined || requests.dock !== undefined;
	if (!explicit)
		return {
			selected: plan.eager.map((descriptor) => ({ descriptor, state: {} })),
			skipped: plan.skipped,
		};
	const requestedCount = (requests.page?.length ?? 0) + (requests.dock?.length ?? 0);
	if (requestedCount > MaxZoneEagerBlockExecutions)
		throw new InvalidSearch(
			`At most ${MaxZoneEagerBlockExecutions} Blocks may execute in one aggregate request`,
		);
	const descriptorKey = (surface: ZoneBlockExecutionSurface, path: BlockPath) =>
		`${surface}:${encodeBlockPath(path)}`;
	const descriptors = new Map(
		plan.descriptors.map((descriptor) => [
			descriptorKey(descriptor.surface, descriptor.path),
			descriptor,
		]),
	);
	const requestedKeys = new Set<string>();
	const select = (
		surface: ZoneBlockExecutionSurface,
		surfaceRequests: readonly BlockExecutionRequest[] | undefined,
	) =>
		(surfaceRequests ?? []).map((request) => {
			const key = descriptorKey(surface, request.path);
			if (requestedKeys.has(key))
				throw new InvalidSearch(
					`Block path ${encodeBlockPath(request.path)} is requested more than once`,
				);
			requestedKeys.add(key);
			const descriptor = descriptors.get(key);
			if (!descriptor)
				throw new InvalidSearch(
					`Block path ${encodeBlockPath(request.path)} is not executable on this Zone surface`,
				);
			return {
				descriptor,
				...(request.selectionSeed ? { selectionSeed: request.selectionSeed } : {}),
				state: parseSearchFeatureState(request.state ?? {}),
			};
		});
	const selected = [...select("page", requests.page), ...select("dock", requests.dock)];
	return { selected, skipped: [] };
}

function boundedState(state: SearchFeatureState, maximumItems: number): SearchFeatureState {
	return {
		...state,
		pageSize: Math.min(state.pageSize ?? maximumItems, maximumItems, AggregateBlockItemLimit),
	};
}

function aggregateSearchTotal(groups: ZoneSearchExecutionResponse["groups"]) {
	return {
		kind: groups.some(({ total }) => total.kind === "lower-bound")
			? ("lower-bound" as const)
			: ("exact" as const),
		value: groups.reduce((total, group) => total + group.total.value, 0),
	};
}

function isolatedError(cause: unknown): ZonePageAggregateExecutionResult {
	if (cause instanceof AggregateBlockTimeout) return { kind: "error", code: "SearchTimeout" };
	if (cause instanceof InvalidSearch) return { kind: "error", code: "InvalidSearch" };
	if (cause instanceof CollectionNotFound) return { kind: "error", code: "CollectionNotFound" };
	if (cause instanceof UnitNotFound) return { kind: "error", code: "UnitNotFound" };
	if (cause instanceof SearchUnavailable) return { kind: "error", code: "SearchUnavailable" };
	logger.error("Zone aggregate Block execution failed", {
		eventName: "search.zone_page_aggregate.block_failed",
		errorCode: "SearchUnavailable",
		error: cause,
	});
	return { kind: "error", code: "SearchUnavailable" };
}

class AggregateBlockTimeout extends Error {}

function admitAggregateExecution(): () => void {
	if (activeAggregateExecutions >= AggregateServiceConcurrency)
		throw new SearchUnavailable(
			new Error("Zone aggregate execution capacity is temporarily exhausted"),
		);
	activeAggregateExecutions += 1;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		activeAggregateExecutions -= 1;
	};
}

async function executeDescriptor(input: {
	readonly authorization: Authorization;
	readonly surface: ZonePageExecutionSurface;
	readonly descriptor: ZoneBlockExecutionDescriptor;
	readonly selectionSeed?: string;
	readonly state: SearchFeatureState;
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly executors: ZonePageAggregateExecutors;
}): Promise<ZonePageAggregateExecutionResult> {
	const { block } = input.descriptor;
	const document =
		input.descriptor.surface === "page" ? input.surface.page.document : input.surface.dock;
	if (!document) throw new InvalidSearch("The selected Dock Block is unavailable");

	if (block._type === "unit-list") {
		if (block.source.kind === "collection") {
			const unsupportedState =
				input.state.filter !== undefined ||
				input.state.expression !== undefined ||
				input.state.sort !== undefined;
			if (unsupportedState)
				throw new InvalidSearch("Collection-backed Unit Lists accept only paging state");
			const result = await getCollectionContent(block.source.collectionId, input.authorization, {
				localizationLanguages: input.localizationLanguages,
				cursor: input.state.cursor,
				limit: Math.min(input.state.pageSize ?? block.limit, block.limit, AggregateBlockItemLimit),
			});
			return {
				kind: "ok",
				blockType: "unit-list",
				itemKind: "feed-item",
				items: result.items.map(({ content }) => content),
				...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
			};
		}
		const result = await input.executors.executeSearch({
			descriptor: input.descriptor,
			document,
			source: block.source.kind === "search" ? block.source.feature : block.source,
			state: boundedState(input.state, block.limit),
			selectionSeed: input.selectionSeed,
			localizationLanguages: input.localizationLanguages,
		});
		if (result.hidden) return { kind: "hidden" };
		return {
			kind: "ok",
			blockType: "unit-list",
			itemKind: "search-hit",
			items: result.groups.flatMap(({ hits }) => hits).slice(0, AggregateBlockItemLimit),
			...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
			...(result.advisory ? { advisory: result.advisory } : {}),
			...(result.facets
				? {
						facets: result.facets.map((facet) => ({
							...facet,
							options: facet.options.map((option) => ({ ...option, count: { ...option.count } })),
						})),
					}
				: {}),
			total: aggregateSearchTotal(result.groups),
			...(result.selected ? { selected: result.selected } : {}),
			...(result.selectionSeed ? { selectionSeed: result.selectionSeed } : {}),
		};
	}

	const result = await input.executors.executeFeed({
		descriptor: input.descriptor,
		document,
		state: boundedState(input.state, AggregateBlockItemLimit),
		selectionSeed: input.selectionSeed,
		localizationLanguages: input.localizationLanguages,
	});
	if (result.hidden) return { kind: "hidden" };
	return {
		kind: "ok",
		blockType: "feed",
		itemKind: "feed-item",
		items: result.items.slice(0, AggregateBlockItemLimit),
		...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
		...(result.advisory ? { advisory: result.advisory } : {}),
		...(result.facets
			? {
					facets: result.facets.map((facet) => ({
						...facet,
						options: facet.options.map((option) => ({ ...option, count: { ...option.count } })),
					})),
				}
			: {}),
		total: result.total,
		...(result.selected ? { selected: result.selected } : {}),
		...(result.selectionSeed ? { selectionSeed: result.selectionSeed } : {}),
	};
}

interface ExecutionJob {
	readonly descriptor: ZoneBlockExecutionDescriptor;
	readonly run: () => Promise<ZonePageAggregateExecutionResult>;
	readonly promise: Promise<ZonePageAggregateExecutionResult>;
	readonly resolve: (result: ZonePageAggregateExecutionResult) => void;
	settled: boolean;
}

function createExecutionJob(
	descriptor: ZoneBlockExecutionDescriptor,
	run: () => Promise<ZonePageAggregateExecutionResult>,
): ExecutionJob {
	let resolve!: (result: ZonePageAggregateExecutionResult) => void;
	const promise = new Promise<ZonePageAggregateExecutionResult>((settle) => {
		resolve = settle;
	});
	return { descriptor, run, promise, resolve, settled: false };
}

/** Executes jobs lazily with four workers and publishes each timeout independently. */
async function runIsolated(
	jobs: readonly ExecutionJob[],
): Promise<ZonePageAggregateExecutionResult[]> {
	if (jobs.length === 0) return [];
	let nextIndex = 0;
	const workerCount = Math.min(
		AggregateExecutionConcurrency,
		AggregateServiceConcurrency,
		jobs.length,
	);
	const settle = (job: ExecutionJob, result: ZonePageAggregateExecutionResult) => {
		if (job.settled) return;
		job.settled = true;
		job.resolve(result);
	};
	const worker = async () => {
		while (nextIndex < jobs.length) {
			const job = jobs[nextIndex++];
			if (!job || job.settled) continue;
			const timer = setTimeout(
				() => settle(job, isolatedError(new AggregateBlockTimeout())),
				AggregateBlockDeadlineMilliseconds,
			);
			let releaseAdmission: (() => void) | undefined;
			try {
				releaseAdmission = admitAggregateExecution();
				settle(
					job,
					await withSearchStatementTimeout(AggregateStatementTimeoutMilliseconds, () =>
						withDatabaseTransactionDeadline(AggregateStatementTimeoutMilliseconds, job.run),
					),
				);
			} catch (cause) {
				settle(job, isolatedError(cause));
			} finally {
				releaseAdmission?.();
				clearTimeout(timer);
			}
		}
	};
	for (let index = 0; index < workerCount; index++)
		void worker().catch((cause) => {
			logger.error("Zone aggregate execution worker failed", {
				eventName: "search.zone_page_aggregate.worker_failed",
				errorCode: "SearchUnavailable",
				error: cause,
			});
		});
	const horizon = setTimeout(
		() => {
			for (const job of jobs) settle(job, isolatedError(new AggregateBlockTimeout()));
		},
		AggregateBlockDeadlineMilliseconds * Math.max(1, Math.ceil(jobs.length / workerCount)),
	);
	try {
		return await Promise.all(jobs.map(({ promise }) => promise));
	} finally {
		clearTimeout(horizon);
	}
}

export async function executeZonePageAggregate(input: {
	readonly surface: ZonePageExecutionSurface;
	readonly selected: ReturnType<typeof selectZonePageBlockExecutions>["selected"];
	readonly skipped: ReturnType<typeof selectZonePageBlockExecutions>["skipped"];
	readonly authorization: Authorization;
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly executors: ZonePageAggregateExecutors;
}): Promise<{
	page: { results: ZonePageAggregateExecutionEntry[] };
	dock?: { results: ZonePageAggregateExecutionEntry[] };
}> {
	const jobs = input.selected.map(({ descriptor, selectionSeed, state }) =>
		createExecutionJob(descriptor, () =>
			executeDescriptor({
				authorization: input.authorization,
				surface: input.surface,
				descriptor,
				selectionSeed,
				state,
				localizationLanguages: input.localizationLanguages,
				executors: input.executors,
			}),
		),
	);
	const outcomes = await runIsolated(jobs);
	const outcomeByDescriptor = new Map<
		ZoneBlockExecutionDescriptor,
		ZonePageAggregateExecutionResult
	>();
	for (const descriptor of input.skipped)
		outcomeByDescriptor.set(descriptor, { kind: "skipped", reason: descriptor.reason });
	for (const [index, job] of jobs.entries())
		outcomeByDescriptor.set(job.descriptor, outcomes[index]!);
	const entries = input.surface.plan.descriptors.flatMap((descriptor) => {
		const outcome = outcomeByDescriptor.get(descriptor);
		return outcome
			? [{ surface: descriptor.surface, entry: { path: [...descriptor.path], outcome } }]
			: [];
	});
	const page = entries.filter(({ surface }) => surface === "page").map(({ entry }) => entry);
	const dock = entries.filter(({ surface }) => surface === "dock").map(({ entry }) => entry);
	return {
		page: { results: page },
		...(input.surface.dock ? { dock: { results: dock } } : {}),
	};
}
