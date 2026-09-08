import type { UnitReference, UnitOwner } from "@rezics/reference";
import type { DatabaseExecutor } from "../database";
import type { CreditAttributionRole } from "../database/schema/contract-values";
import { readUnitState } from "./query";
/** Manual contribution roles are distinct from native source credit relations and their vocabulary revisions. */
const written = [
	"author",
	"co-author",
	"translator",
	"illustrator",
	"editor",
	"publisher",
	"letterer",
	"colorist",
] as const;
const screen = [
	"director",
	"producer",
	"writer",
	"publisher",
	"composer",
	"actor",
	"narrator",
	"studio",
	"distributor",
] as const;
const software = [
	"developer",
	"publisher",
	"composer",
	"designer",
	"director",
	"producer",
	"writer",
	"translator",
	"illustrator",
	"editor",
] as const;
const basic = ["author", "editor", "publisher"] as const;
const byOwner = {
	publishing: written,
	program: screen,
	music: screen,
	software,
	entity: ["publisher", "actor"],
	grouping: basic,
	reference: basic,
	distribution: ["publisher", "distributor"],
	video: screen,
	audio: screen,
	post: written,
	poll: basic,
	zone: basic,
	realm: basic,
	realm_rule: basic,
	custom_theme: software,
	collection: ["publisher"],
	tag: basic,
	tag_path: basic,
	label: basic,
} as const satisfies Record<UnitOwner, readonly CreditAttributionRole[]>;
export async function creditRoleAllowedForReference(
	executor: DatabaseExecutor,
	reference: UnitReference,
	role: CreditAttributionRole,
): Promise<boolean> {
	const current = await readUnitState(executor, reference);
	if (!current) return false;
	const roles: readonly CreditAttributionRole[] = byOwner[reference.owner];
	return roles.includes(role);
}
