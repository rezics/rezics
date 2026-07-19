import {
	PatchApiRealmsByRealmIdUnitsByUnitIdRequestReasonCodeEnum,
	type GetApiRealmsByRealmIdUnitsStatus200ItemsStatusEnum,
	type PatchApiRealmsByRealmIdUnitsByUnitIdRequestCommandEnum,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextValue } from "@rezics/portable-text";

export type RealmModerationStatus = GetApiRealmsByRealmIdUnitsStatus200ItemsStatusEnum;
export type RealmModerationCommand =
	PatchApiRealmsByRealmIdUnitsByUnitIdRequestCommandEnum | "note";

export const RealmModerationStatuses = [
	"pending",
	"visible",
	"hidden",
	"removed",
] as const satisfies readonly RealmModerationStatus[];

export const GovernanceReasonCodes = Object.values(
	PatchApiRealmsByRealmIdUnitsByUnitIdRequestReasonCodeEnum,
);

const StateCommands = {
	pending: ["approve", "remove"],
	visible: ["hide", "remove"],
	hidden: ["restore", "remove"],
	removed: ["restore"],
} as const satisfies Record<
	RealmModerationStatus,
	readonly PatchApiRealmsByRealmIdUnitsByUnitIdRequestCommandEnum[]
>;

export function getRealmModerationCommands(
	status: RealmModerationStatus,
	locked: boolean,
): readonly RealmModerationCommand[] {
	return [...StateCommands[status], locked ? "unlock" : "lock", "note"];
}

export function hasAuthoredAnnotation(value: PortableTextValue): boolean {
	return value.some(
		(block) =>
			block._type === "image" || block.children.some((child) => child.text.trim().length > 0),
	);
}

export function toRealmModerationStatus(value: string): RealmModerationStatus | "all" {
	return RealmModerationStatuses.find((status) => status === value) ?? "all";
}

export function toRealmModerationCommand(
	value: string,
	allowed: readonly RealmModerationCommand[],
): RealmModerationCommand {
	return allowed.find((command) => command === value) ?? allowed[0] ?? "note";
}

export function toGovernanceReasonCode(value: string): (typeof GovernanceReasonCodes)[number] {
	return GovernanceReasonCodes.find((reason) => reason === value) ?? "other";
}
