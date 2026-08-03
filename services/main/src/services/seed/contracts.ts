// ```progress
// id: seed.separate-scenario-programs
// status: open
// goal: Separate professional demonstration data from destructive coverage and stress scenarios.
// depends: []
// accept:
//   - Maintainers can run a deterministic professional-data program without creating intentionally malformed, chaotic, or load-oriented records.
//   - Coverage and stress programs are independently selectable and retain the boundary cases needed by automated checks.
//   - Every program is idempotent for its documented target and refuses unsafe production configuration.
//   - Shared builders preserve one contract without coupling the scenario lifecycles.
// verify:
//   - Run the professional program twice against an isolated database and compare the resulting fixture identities and relationships.
//   - Run each coverage and stress program independently and exercise its owning service tests.
//   - Verify that every program rejects a production-like target.
// ```
export const SeedProfileValues = ["demo", "coverage"] as const;
export type SeedProfile = (typeof SeedProfileValues)[number];

export const SeedScenarioValues = [
	"identities",
	"units",
	"official-zone-content",
	"content",
	"structure",
	"interactions",
	"communications",
	"governance",
	"feature-contracts",
	"recommendations",
	"history",
] as const;
export type SeedScenario = (typeof SeedScenarioValues)[number];

export const DefaultSeedReferenceTime = "2026-07-15T12:00:00.000Z";

const ProfileScenarios = {
	demo: SeedScenarioValues.filter(
		(value): value is Exclude<SeedScenario, "communications" | "governance"> =>
			value !== "communications" && value !== "governance",
	),
	coverage: SeedScenarioValues,
} as const satisfies Record<SeedProfile, readonly SeedScenario[]>;

export interface SeedRunOptions {
	readonly profile: SeedProfile;
	readonly referenceTime: Date;
	readonly scenarios: readonly SeedScenario[];
}

function parseProfile(value: string | undefined): SeedProfile {
	switch (value) {
		case "demo":
		case "coverage":
			return value;
		default:
			throw new TypeError(
				`Seed profile must be one of ${SeedProfileValues.join(", ")}; received ${value ?? "nothing"}`,
			);
	}
}

function parseReferenceTime(value: string | undefined): Date {
	if (!value) throw new TypeError("Seed reference time is missing");
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime()))
		throw new TypeError(`Invalid Seed reference time: ${value}`);
	return parsed;
}

export function createSeedRunOptions(
	input: {
		readonly profile?: SeedProfile;
		readonly referenceTime?: Date;
	} = {},
): SeedRunOptions {
	const profile = input.profile ?? "demo";
	const referenceTime = input.referenceTime ?? new Date(DefaultSeedReferenceTime);
	if (Number.isNaN(referenceTime.getTime()))
		throw new TypeError("Seed reference time is invalid");
	return {
		profile,
		referenceTime,
		scenarios: ProfileScenarios[profile],
	};
}

export function parseSeedRunOptions(arguments_: readonly string[]): SeedRunOptions {
	let profile: SeedProfile = "demo";
	let referenceTime: Date | undefined;
	for (let index = 0; index < arguments_.length; index += 1) {
		const flag = arguments_[index];
		const value = arguments_[index + 1];
		if (flag === "--profile") {
			profile = parseProfile(value);
			index += 1;
			continue;
		}
		if (flag === "--reference-time") {
			referenceTime = parseReferenceTime(value);
			index += 1;
			continue;
		}
		throw new TypeError(
			"Usage: seed.ts [--profile demo|coverage] [--reference-time ISO_DATE_TIME]",
		);
	}
	return createSeedRunOptions({ profile, ...(referenceTime ? { referenceTime } : {}) });
}

export function includesSeedScenario(
	options: Pick<SeedRunOptions, "scenarios">,
	scenario: SeedScenario,
): boolean {
	return options.scenarios.some((candidate) => candidate === scenario);
}
