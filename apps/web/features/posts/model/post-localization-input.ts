function normalizePostLocalizationText(value: FormDataEntryValue | null): string | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim();
	return normalized.length ? normalized : null;
}

export function optionalPostLocalizationText(
	form: FormData,
	name: "summary" | "title",
): string | undefined {
	return normalizePostLocalizationText(form.get(name)) ?? undefined;
}

export function nullablePostLocalizationText(
	form: FormData,
	name: "summary" | "title",
): string | null {
	return normalizePostLocalizationText(form.get(name));
}
