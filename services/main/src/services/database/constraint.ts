function property(error: object, name: "cause" | "code" | "constraint"): unknown {
	try {
		return Reflect.get(error, name);
	} catch {
		return undefined;
	}
}

function* databaseErrorCauseChain(error: unknown): Generator<object> {
	const visited = new Set<unknown>();
	let current = error;
	while (current && typeof current === "object" && !visited.has(current)) {
		visited.add(current);
		yield current;
		current = property(current, "cause");
	}
}

export function databaseSqlState(error: unknown): string | undefined {
	for (const candidate of databaseErrorCauseChain(error)) {
		const code = property(candidate, "code");
		if (typeof code === "string") return code;
	}
	return undefined;
}

export function databaseConstraintName(error: unknown): string | undefined {
	for (const candidate of databaseErrorCauseChain(error)) {
		const constraint = property(candidate, "constraint");
		if (typeof constraint === "string") return constraint;
	}
	return undefined;
}

export function databaseErrorMatches(
	error: unknown,
	expected: { readonly code: string; readonly constraint: string },
): boolean {
	for (const candidate of databaseErrorCauseChain(error)) {
		if (
			property(candidate, "code") === expected.code &&
			property(candidate, "constraint") === expected.constraint
		)
			return true;
	}
	return false;
}
