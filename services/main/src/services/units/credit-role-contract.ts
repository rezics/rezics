import type { UnitReference, UnitOwner } from "@rezics/reference";
import type { DatabaseExecutor } from "../database";
import type { CreditAttributionRole } from "@rezics/schema/postgres/shared/contract-values";
import { readUnitState } from "./query";
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
const release = [
	"developer",
	"publisher",
	"distributor",
	"translator",
	"editor",
	"producer",
	"studio",
] as const;
const basic = ["author", "editor", "publisher"] as const;
const publication = [
	"publisher",
	"distributor",
	"editor",
	"illustrator",
	"letterer",
	"colorist",
] as const;
const musicalWork = ["composer", "writer", "publisher", "editor"] as const;
const recording = [
	"composer",
	"producer",
	"publisher",
	"actor",
	"narrator",
	"studio",
	"director",
] as const;
const shapes = {
	publishing: { work: written, text_version: written, publication, serialization: publication },
	software: { content: software, version: software, release },
	program: {
		program: screen,
		season: screen,
		program_version: [...screen, "translator", "editor"],
		episode: screen,
	},
	music: {
		work: musicalWork,
		recording,
		release_group: publication,
		release: publication,
	},
	entity: {
		person: ["publisher"],
		organization: ["publisher"],
		character: ["publisher", "actor"],
		unresolved: ["publisher"],
	},
	video: { video: screen },
	audio: { audio: screen },
	post: {
		post: written,
		wiki: written,
		review: written,
		article: written,
		chapter: written,
		comment: written,
		zone_page: written,
		governance_note: written,
	},
	poll: { poll: basic },
	zone: { zone: basic },
	realm: { realm: basic },
	realm_rule: { realm_rule: basic },
	custom_theme: { custom_theme: software },
	collection: { collection: ["publisher"] },
	tag: { tag: basic },
	tag_path: { tag_path: basic },
	label: { label: basic },
} as const satisfies Partial<Record<UnitOwner, Record<string, readonly CreditAttributionRole[]>>>;
/** Manual record attributions are distinct from native source credit relations and their reviewed vocabulary revisions. */
export function creditRolesForReference(reference: {
	owner: UnitOwner;
	shape: string;
}): readonly CreditAttributionRole[] {
	if (reference.owner === "grouping" || reference.owner === "reference") return basic;
	if (reference.owner === "distribution") return ["publisher", "distributor"];
	const ownerShapes: Readonly<Record<string, readonly CreditAttributionRole[]>> =
		shapes[reference.owner];
	return ownerShapes[reference.shape] ?? [];
}
export async function creditRoleAllowedForReference(
	executor: DatabaseExecutor,
	reference: UnitReference,
	role: CreditAttributionRole,
): Promise<boolean> {
	const current = await readUnitState(executor, reference);
	return Boolean(
		current &&
			creditRolesForReference({ owner: reference.owner, shape: current.shape }).includes(role),
	);
}
