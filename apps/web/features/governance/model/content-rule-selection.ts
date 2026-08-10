import type { GetApiReportsUnitsByUnitIdDestinationsStatus200 } from "@rezics/openapi-tanstack-query";

export const ContentGovernanceMaximumRuleReferences = 32;

type ApiContentRuleDestination = GetApiReportsUnitsByUnitIdDestinationsStatus200["items"][number];

export type ContentRuleDestination = Readonly<
	Omit<ApiContentRuleDestination, "rules"> & {
		readonly rules: readonly ApiContentRuleDestination["rules"][number][];
	}
>;

export type ContentRuleReference = Readonly<{
	sourceRealmId: string;
	revisionId: string;
	ruleId: string;
}>;

export function contentRuleSelectionKey(
	sourceRealmId: string,
	revisionId: string,
	ruleId: string,
): string {
	return `${sourceRealmId}:${revisionId}:${ruleId}`;
}

export function getContentRuleDestination(
	destinations: readonly ContentRuleDestination[],
	preferredSourceRealmId?: string,
): ContentRuleDestination | undefined {
	if (preferredSourceRealmId) {
		const preferred = destinations.find(({ id }) => id === preferredSourceRealmId);
		if (preferred) return preferred;
	}
	return destinations.find((destination) => destination.scope === "realm") ?? destinations[0];
}

export function getContentRuleKeys(destination: ContentRuleDestination | undefined): string[] {
	if (!destination) return [];
	return destination.rules.map((rule) =>
		contentRuleSelectionKey(destination.id, destination.revisionId, rule.id),
	);
}

export function getAvailableContentRuleKeys(
	destinations: readonly ContentRuleDestination[],
): string[] {
	return destinations.flatMap((destination) => getContentRuleKeys(destination));
}

export function retainAvailableContentRuleSelection(
	selectedKeys: readonly string[],
	destinations: readonly ContentRuleDestination[],
): string[] {
	const availableKeys = new Set(getAvailableContentRuleKeys(destinations));
	const retainedKeys: string[] = [];
	const retainedKeySet = new Set<string>();
	for (const key of selectedKeys) {
		if (!availableKeys.has(key) || retainedKeySet.has(key)) continue;
		retainedKeys.push(key);
		retainedKeySet.add(key);
	}
	return retainedKeys;
}

export function getContentRuleReferences(
	destinations: readonly ContentRuleDestination[],
	selectedKeys: readonly string[],
): ContentRuleReference[] {
	const selectedKeySet = new Set(selectedKeys);
	return destinations.flatMap((destination) =>
		destination.rules.flatMap((rule) => {
			const key = contentRuleSelectionKey(destination.id, destination.revisionId, rule.id);
			return selectedKeySet.has(key)
				? [
						{
							sourceRealmId: destination.id,
							revisionId: destination.revisionId,
							ruleId: rule.id,
						},
					]
				: [];
		}),
	);
}

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
