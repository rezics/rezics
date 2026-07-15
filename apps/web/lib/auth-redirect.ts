export function getSafeAuthDestination(value: string | null) {
	return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
