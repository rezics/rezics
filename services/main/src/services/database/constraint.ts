export function databaseConstraintName(error: unknown): string | undefined {
	const visited = new Set<unknown>();
	let current = error;
	while (current && typeof current === "object" && !visited.has(current)) {
		visited.add(current);
		const constraint = Reflect.get(current, "constraint");
		if (typeof constraint === "string") return constraint;
		current = Reflect.get(current, "cause");
	}
	return undefined;
}
