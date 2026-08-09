import type {
	GetApiRealmsByRealmIdUnitsStatus200ItemsAllowedCommandsEnum,
	GetApiRealmsByRealmIdUnitsStatus200ItemsStatusEnum,
} from "@rezics/openapi-tanstack-query";
import { isPortableTextValueBlock, type PortableTextValue } from "@rezics/portable-text";

export type RealmModerationStatus = GetApiRealmsByRealmIdUnitsStatus200ItemsStatusEnum;
export type RealmModerationCommand = GetApiRealmsByRealmIdUnitsStatus200ItemsAllowedCommandsEnum;

export const RealmModerationStatuses = [
	"pending",
	"visible",
	"hidden",
	"removed",
] as const satisfies readonly RealmModerationStatus[];

export function hasAuthoredAnnotation(value: PortableTextValue): boolean {
	return value.some(
		(block) =>
			block._type === "image" ||
			(isPortableTextValueBlock(block) &&
				block.children.some(
					(child) => child._type === "span" && child.text.trim().length > 0,
				)),
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

export function realmGovernanceActionRequiresRules(
	command: RealmModerationCommand,
): command is Extract<RealmModerationCommand, "hide" | "remove" | "lock_post_targeting"> {
	return command === "hide" || command === "remove" || command === "lock_post_targeting";
}
