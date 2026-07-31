import type { GetApiUnitsByTypeByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";

type ReleaseStatusDetails = Extract<
	GetApiUnitsByTypeByUnitIdStatus200["details"],
	{ readonly type: "book" | "media" }
>;

export type WorkReleaseStatus = ReleaseStatusDetails["releaseStatus"];

const workReleaseStatusValues = [
	"ongoing",
	"hiatus",
	"completed",
	"cancelled",
] as const satisfies readonly WorkReleaseStatus[];

type ExhaustiveWorkReleaseStatusValues<Values extends readonly WorkReleaseStatus[]> =
	Exclude<WorkReleaseStatus, Values[number]> extends never ? Values : never;

export const WorkReleaseStatusValues: ExhaustiveWorkReleaseStatusValues<
	typeof workReleaseStatusValues
> = workReleaseStatusValues;

export function isWorkReleaseStatus(value: unknown): value is WorkReleaseStatus {
	return WorkReleaseStatusValues.some((status) => status === value);
}
