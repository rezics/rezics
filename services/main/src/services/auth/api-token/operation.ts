function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Mirrors Elysia OpenAPI's deterministic operation ID for the matched route template. */
export function apiTokenOperationId(method: string, route: string): string {
	let operationId = method.toLowerCase();
	if (!route || route === "/") return `${operationId}Index`;
	for (const pathPart of route.split("/")) {
		operationId += pathPart.includes(":")
			? `By${capitalize(pathPart.replace(":", ""))}`
			: capitalize(pathPart);
	}
	return operationId.replaceAll("?", "Optional");
}

const OperationCostUnits = {
	postApiSearchExecute: 5,
	"postApiSearchUnitsByUnitIdContent-structuresByStructureIdNodesByNodeIdExecute": 5,
	postApiSearchZonesByZoneIdDockBlocksByBlockKeyExecute: 5,
	postApiSearchZonesByZoneIdPagesByPageIdBlocksByBlockKeyExecute: 5,
	"postApiImage-assets": 10,
} as const satisfies Readonly<Record<string, number>>;

export function apiTokenOperationCostUnits(operationId: string): number {
	return OperationCostUnits[operationId as keyof typeof OperationCostUnits] ?? 1;
}
