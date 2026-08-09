export const ContentGovernanceMaximumRuleReferences = 32;

export function updateContentRuleSelection(
	current: readonly string[],
	key: string,
	checked: boolean,
): string[] {
	if (!checked) return current.filter((value) => value !== key);
	if (current.includes(key)) return [...current];
	if (current.length >= ContentGovernanceMaximumRuleReferences) return [...current];
	return [...current, key];
}
