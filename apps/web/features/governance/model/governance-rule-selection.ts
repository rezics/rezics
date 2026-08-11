export const GovernanceMaximumRuleReferences = 32;

export type GovernanceRuleSource = Readonly<{
	id: string;
	scope: "platform" | "realm" | "local";
	title?: string | null;
	revisionId: string;
	rules: readonly Readonly<{
		id: string;
		title: string;
	}>[];
}>;

export type GovernanceRuleReference = Readonly<{
	sourceRealmId: string;
	revisionId: string;
	ruleId: string;
}>;

export function governanceRuleSelectionKey(
	sourceRealmId: string,
	revisionId: string,
	ruleId: string,
): string {
	return `${sourceRealmId}:${revisionId}:${ruleId}`;
}

export function getGovernanceRuleSource(
	sources: readonly GovernanceRuleSource[],
	preferredSourceRealmId?: string,
): GovernanceRuleSource | undefined {
	if (preferredSourceRealmId) {
		const preferred = sources.find(({ id }) => id === preferredSourceRealmId);
		if (preferred) return preferred;
	}
	return (
		sources.find((source) => source.scope === "local") ??
		sources.find((source) => source.scope === "realm") ??
		sources[0]
	);
}

export function getGovernanceRuleKeys(source: GovernanceRuleSource | undefined): string[] {
	if (!source) return [];
	return source.rules.map((rule) =>
		governanceRuleSelectionKey(source.id, source.revisionId, rule.id),
	);
}

export function getAvailableGovernanceRuleKeys(sources: readonly GovernanceRuleSource[]): string[] {
	return sources.flatMap((source) => getGovernanceRuleKeys(source));
}

export function retainAvailableGovernanceRuleSelection(
	selectedKeys: readonly string[],
	sources: readonly GovernanceRuleSource[],
): string[] {
	const availableKeys = new Set(getAvailableGovernanceRuleKeys(sources));
	const retainedKeys: string[] = [];
	const retainedKeySet = new Set<string>();
	for (const key of selectedKeys) {
		if (!availableKeys.has(key) || retainedKeySet.has(key)) continue;
		retainedKeys.push(key);
		retainedKeySet.add(key);
	}
	return retainedKeys;
}

export function getGovernanceRuleReferences(
	sources: readonly GovernanceRuleSource[],
	selectedKeys: readonly string[],
): GovernanceRuleReference[] {
	const selectedKeySet = new Set(selectedKeys);
	return sources.flatMap((source) =>
		source.rules.flatMap((rule) => {
			const key = governanceRuleSelectionKey(source.id, source.revisionId, rule.id);
			return selectedKeySet.has(key)
				? [
						{
							sourceRealmId: source.id,
							revisionId: source.revisionId,
							ruleId: rule.id,
						},
					]
				: [];
		}),
	);
}

export function updateGovernanceRuleSelection(
	current: readonly string[],
	key: string,
	checked: boolean,
): string[] {
	if (!checked) return current.filter((value) => value !== key);
	if (current.includes(key)) return [...current];
	if (current.length >= GovernanceMaximumRuleReferences) return [...current];
	return [...current, key];
}
