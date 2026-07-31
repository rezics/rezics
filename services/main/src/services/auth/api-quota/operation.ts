export const ApiQuotaOperationIds = ["search.execute", "image.upload"] as const;

export type ApiQuotaOperationId = (typeof ApiQuotaOperationIds)[number];

export type ResolvedApiQuotaOperation =
	| { readonly scope: null; readonly costUnits: 1 }
	| {
			readonly scope: ApiQuotaOperationId;
			readonly costUnits: number;
	  };

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
	if (!route || route === "/") return `${operationId}Index`;
	for (const pathPart of route.split("/")) {
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
	"postApiSearchUnitsByUnitIdContent-structuresByStructureIdNodesByNodeIdExecute":
		"search.execute",
	postApiSearchZonesByZoneIdDockBlocksByBlockKeyExecute: "search.execute",
	postApiSearchZonesByZoneIdPagesByPageIdBlocksByBlockKeyExecute: "search.execute",
	"postApiSearchZonesByZoneIdFeed-blocksByBlockKeyExecute": "search.execute",
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
): ResolvedApiQuotaOperation {
	const definition = definitionById.get(scope);
	if (!definition) throw new Error(`Missing API quota operation definition: ${scope}`);
	return { scope, costUnits: definition.costUnits };
}
