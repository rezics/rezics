const fontAwesomeWorkerVariableNames = [
	"FONT_AWESOME_KIT_CSS_URL",
	"FONT_AWESOME_KIT_LICENSE",
] as const;

type FontAwesomeWorkerVariableName = (typeof fontAwesomeWorkerVariableNames)[number];

export function fontAwesomeWorkerVariables(
	environment: Readonly<Record<string, string | undefined>>,
): Partial<Record<FontAwesomeWorkerVariableName, string>> {
	const variables: Partial<Record<FontAwesomeWorkerVariableName, string>> = {};
	for (const name of fontAwesomeWorkerVariableNames) {
		const value = environment[name]?.trim();
		if (value) variables[name] = value;
	}
	return variables;
}
