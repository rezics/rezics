import {
	normalizePortableText,
	portableTextMetricText,
	type PortableTextValue,
} from "@rezics/portable-text";

export function joinDraftContentLanguageSample(
	parts: readonly (string | null | undefined)[],
): string {
	return parts
		.map((part) => part?.trim())
		.filter((part): part is string => Boolean(part))
		.join("\n");
}

export function portableTextDraftContentLanguageSample(content: PortableTextValue): string {
	return portableTextMetricText(normalizePortableText(content));
}

export function readDraftContentLanguageFormSample(
	form: HTMLFormElement,
	fieldNames: readonly string[],
	additionalText?: string,
): string {
	const data = new FormData(form);
	return joinDraftContentLanguageSample([
		...fieldNames.flatMap((fieldName) =>
			data.getAll(fieldName).filter((value): value is string => typeof value === "string"),
		),
		additionalText,
	]);
}
