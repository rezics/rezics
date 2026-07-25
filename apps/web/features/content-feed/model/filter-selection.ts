export type FilterSelection<Value> =
	Readonly<{ mode: "all" }> | Readonly<{ mode: "only"; values: readonly [Value, ...Value[]] }>;

export function filterSelectionFromValues<Value>(values: readonly Value[]): FilterSelection<Value> {
	const [first, ...rest] = values;
	return first === undefined ? { mode: "all" } : { mode: "only", values: [first, ...rest] };
}

export function filterSelectionValues<Value>(
	selection: FilterSelection<Value>,
	allValues: readonly Value[],
): readonly Value[] {
	return selection.mode === "all" ? allValues : selection.values;
}
