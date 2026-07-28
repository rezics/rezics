type SelectItem = Readonly<{ id: string }>;

export function selectReportRealmId(
	items: readonly SelectItem[] | undefined,
	contextRealmId: string | undefined,
	selectedRealmId: string,
): string | undefined {
	return (
		items?.find((item) => item.id === selectedRealmId)?.id ??
		items?.find((item) => item.id === contextRealmId)?.id ??
		items?.[0]?.id
	);
}

export function selectReportRuleId(
	items: readonly SelectItem[] | undefined,
	selectedRuleId: string,
): string | undefined {
	return items?.find((item) => item.id === selectedRuleId)?.id ?? items?.[0]?.id;
}
