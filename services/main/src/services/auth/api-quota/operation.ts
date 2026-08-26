export const ApiQuotaOperationIds = ["search.execute", "image.upload"] as const;

export type ApiQuotaOperationId = (typeof ApiQuotaOperationIds)[number];

export type ResolvedScopedApiQuotaOperation = {
	readonly scope: ApiQuotaOperationId;
	readonly costUnits: number;
};

export type ResolvedApiQuotaOperation =
	| { readonly scope: null; readonly costUnits: 1 }
	| ResolvedScopedApiQuotaOperation;

export const ApiQuotaOperationDefinitions = [
	{ id: "search.execute", costUnits: 5 },
	{ id: "image.upload", costUnits: 10 },
] as const satisfies readonly {
	readonly id: ApiQuotaOperationId;
	readonly costUnits: number;
}[];

const definitionById = new Map(
	ApiQuotaOperationDefinitions.map((definition) => [definition.id, definition] as const),
);

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Mirrors Elysia OpenAPI's deterministic operation ID for the matched route template. */
export function apiRouteOperationId(method: string, route: string): string {
	let operationId = method.toLowerCase();
	const operationRoute = route.replace(/^\/api\/v[1-9]\d*(?=\/|$)/, "/api");
	if (!operationRoute || operationRoute === "/") return `${operationId}Index`;
	for (const pathPart of operationRoute.split("/")) {
		operationId += pathPart.includes(":")
			? `By${capitalize(pathPart.replace(":", ""))}`
			: capitalize(pathPart);
	}
	return operationId.replaceAll("?", "Optional");
}

const QuotaScopeByRouteOperationId = {
	postApiSearch: "search.execute",
	postApiSearchByIndex: "search.execute",
	postApiSearchFeaturesByTemplateExecute: "search.execute",
	postApiSearchFeaturesByTemplateFeed: "search.execute",
	postApiSearchZonesByZoneIdFeatureExecute: "search.execute",
	postApiSearchZonesByZoneIdFeatureFeed: "search.execute",
	"postApiSearchUnitsByUnitIdContent-structuresByStructureIdNodesByNodeIdExecute": "search.execute",
	"postApiSearchZonesByZoneIdDockBlock-executions": "search.execute",
	"postApiSearchZonesByZoneIdPagesByPageIdBlock-executions": "search.execute",
	"postApiSearchZonesByZoneIdDockFeed-block-executions": "search.execute",
	"postApiSearchZonesByZoneIdPagesByPageIdFeed-block-executions": "search.execute",
	"postApiImage-assets": "image.upload",
} as const satisfies Readonly<Record<string, ApiQuotaOperationId>>;

const quotaScopeByRouteOperationId: ReadonlyMap<string, ApiQuotaOperationId> = new Map(
	Object.entries(QuotaScopeByRouteOperationId),
);

export function resolveApiQuotaOperation(routeOperationId: string): ResolvedApiQuotaOperation {
	const scope = quotaScopeByRouteOperationId.get(routeOperationId);
	if (!scope) return { scope: null, costUnits: 1 };
	return resolveApiQuotaOperationById(scope);
}

export function resolveApiQuotaOperationById(
	scope: ApiQuotaOperationId,
): ResolvedScopedApiQuotaOperation {
	const definition = definitionById.get(scope);
	if (!definition) throw new Error(`Missing API quota operation definition: ${scope}`);
	return { scope, costUnits: definition.costUnits };
}

/**
 * Resolves one scoped quota charge for a bounded aggregate operation.
 * Request-rate and concurrency admission still happen once; only daily cost
 * scales with the number of executable children.
 */
export function scaleApiQuotaOperationCost(
	operation: ResolvedScopedApiQuotaOperation,
	executionCount: number,
	maximumExecutionCount: number,
): ResolvedScopedApiQuotaOperation {
	if (!Number.isSafeInteger(maximumExecutionCount) || maximumExecutionCount < 1)
		throw new TypeError("API quota maximum execution count must be a positive safe integer");
	if (
		!Number.isSafeInteger(executionCount) ||
		executionCount < 0 ||
		executionCount > maximumExecutionCount
	)
		throw new RangeError(
			`API quota execution count must be a safe integer between 0 and ${maximumExecutionCount}`,
		);
	const costUnits = operation.costUnits * executionCount;
	if (!Number.isSafeInteger(costUnits))
		throw new RangeError("API quota aggregate cost exceeds the safe integer range");
	return { scope: operation.scope, costUnits };
}
