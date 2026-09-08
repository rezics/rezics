import type { WriteEntityMeasurementContextBody } from "@rezics/openapi-tanstack-query";
export const ContextMeasurementOwners = [
	"publishing",
	"music",
	"program",
	"software",
] as const satisfies readonly WriteEntityMeasurementContextBody["context"]["owner"][];
export type MeasurementValues = WriteEntityMeasurementContextBody["values"];
export type MeasurementDraft = Record<keyof MeasurementValues, string>;
export const MeasurementFields = [
	{ key: "heightMillimetres", label: "height", unit: "millimetres" },
	{ key: "weightGrams", label: "weight", unit: "grams" },
	{ key: "bustMillimetres", label: "bust", unit: "millimetres" },
	{ key: "waistMillimetres", label: "waist", unit: "millimetres" },
	{ key: "hipsMillimetres", label: "hips", unit: "millimetres" },
] as const satisfies readonly { key: keyof MeasurementValues; label: string; unit: string }[];
export function measurementDraft(values: MeasurementValues | undefined): MeasurementDraft {
	return {
		heightMillimetres:
			values?.heightMillimetres === null || values?.heightMillimetres === undefined
				? ""
				: String(values.heightMillimetres),
		weightGrams:
			values?.weightGrams === null || values?.weightGrams === undefined
				? ""
				: String(values.weightGrams),
		bustMillimetres:
			values?.bustMillimetres === null || values?.bustMillimetres === undefined
				? ""
				: String(values.bustMillimetres),
		waistMillimetres:
			values?.waistMillimetres === null || values?.waistMillimetres === undefined
				? ""
				: String(values.waistMillimetres),
		hipsMillimetres:
			values?.hipsMillimetres === null || values?.hipsMillimetres === undefined
				? ""
				: String(values.hipsMillimetres),
	};
}
export function parseMeasurementDraft(draft: MeasurementDraft): MeasurementValues | null {
	const result: MeasurementValues = {
		heightMillimetres: null,
		weightGrams: null,
		bustMillimetres: null,
		waistMillimetres: null,
		hipsMillimetres: null,
	};
	for (const { key } of MeasurementFields) {
		const value = draft[key].trim();
		if (!value) continue;
		const number = Number(value);
		if (!/^\d+$/u.test(value) || !Number.isSafeInteger(number) || number < 0) return null;
		result[key] = number;
	}
	return result;
}
