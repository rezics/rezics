export const ScaleSeedActionValues = ["seed", "purge"] as const;
export type ScaleSeedAction = (typeof ScaleSeedActionValues)[number];

export const ScaleSeedKindValues = ["book", "software", "media"] as const;
export type ScaleSeedKind = (typeof ScaleSeedKindValues)[number];

export const DefaultScaleSeedDistribution = {
	book: 50,
	software: 25,
	media: 25,
} as const satisfies Record<ScaleSeedKind, number>;

export const DefaultScaleSeedBatchSize = 1_000;
export const DefaultScaleSeedEventsPerUnit = 0;
export const MaxScaleSeedUnits = 1_000_000;
export const MaxScaleSeedBatchSize = 5_000;
export const MaxScaleSeedEventsPerUnit = 20;
export const MaxScaleSeedTotalEvents = 10_000_000;

export interface ScaleSeedDistribution {
	readonly book: number;
	readonly software: number;
	readonly media: number;
}

export interface ScaleSeedSeedOptions {
	readonly action: "seed";
	readonly confirmed: true;
	readonly runId: string;
	readonly units: number;
	readonly batchSize: number;
	readonly eventsPerUnit: number;
	readonly referenceTime: Date;
	readonly distribution: ScaleSeedDistribution;
}

export interface ScaleSeedPurgeOptions {
	readonly action: "purge";
	readonly confirmed: true;
	readonly runId: string;
}

export type ScaleSeedOptions = ScaleSeedSeedOptions | ScaleSeedPurgeOptions;

const RunIdPattern = /^[a-z][a-z0-9_-]{0,31}$/;

function isScaleSeedAction(value: string): value is ScaleSeedAction {
	return ScaleSeedActionValues.some((candidate) => candidate === value);
}

function isScaleSeedKind(value: string): value is ScaleSeedKind {
	return ScaleSeedKindValues.some((candidate) => candidate === value);
}

function usage(): string {
	return [
		"Usage:",
		"  scale-seed.ts seed --run-id ID --units N --yes [--batch-size N] [--events-per-unit N] [--distribution book=50,software=25,media=25] [--reference-time ISO_DATE_TIME]",
		"  scale-seed.ts purge --run-id ID --yes",
	].join("\n");
}

function requireFlagValue(arguments_: readonly string[], position: number, flag: string): string {
	const value = arguments_[position + 1];
	if (!value || value.startsWith("--")) throw new TypeError(`${flag} requires a value`);
	return value;
}

function parseBoundedInteger(
	value: string,
	flag: string,
	minimum: number,
	maximum: number,
): number {
	if (!/^\d+$/.test(value)) throw new TypeError(`${flag} must be an integer`);
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
		throw new RangeError(`${flag} must be between ${minimum} and ${maximum}`);
	return parsed;
}

function parseRunId(value: string): string {
	if (!RunIdPattern.test(value))
		throw new TypeError(
			"--run-id must start with a lowercase letter and contain only lowercase letters, digits, '_' or '-' (1-32 characters)",
		);
	return value;
}

function parseReferenceTime(value: string): Date {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) throw new TypeError(`Invalid --reference-time: ${value}`);
	return parsed;
}

function parseDistribution(value: string): ScaleSeedDistribution {
	const distribution: Record<ScaleSeedKind, number> = {
		book: 0,
		software: 0,
		media: 0,
	};
	const seen = new Set<ScaleSeedKind>();
	for (const entry of value.split(",")) {
		const [rawKind, rawWeight, ...extra] = entry.split("=");
		if (!rawKind || !rawWeight || extra.length > 0)
			throw new TypeError(
				"--distribution must use book=N,software=N,media=N entries with no duplicates",
			);
		if (!isScaleSeedKind(rawKind)) throw new TypeError(`Unknown scale-seed kind: ${rawKind}`);
		const kind = rawKind;
		if (seen.has(kind)) throw new TypeError(`Duplicate scale-seed kind: ${kind}`);
		seen.add(kind);
		distribution[kind] = parseBoundedInteger(rawWeight, `distribution ${kind}`, 0, 100);
	}
	if (seen.size !== ScaleSeedKindValues.length)
		throw new TypeError("--distribution must specify book, software, and media exactly once");
	const total = Object.values(distribution).reduce((sum, weight) => sum + weight, 0);
	if (total !== 100) throw new RangeError("--distribution weights must add up to 100");
	if (Object.values(distribution).every((weight) => weight === 0))
		throw new RangeError("--distribution must include at least one non-zero kind");
	return distribution;
}

function assertSeedTotalEvents(units: number, eventsPerUnit: number): void {
	if (units * eventsPerUnit > MaxScaleSeedTotalEvents)
		throw new RangeError(
			`--units multiplied by --events-per-unit must not exceed ${MaxScaleSeedTotalEvents.toLocaleString()} events`,
		);
}

export function scaleSeedTitlePrefix(runId: string): string {
	return `Scale seed [${runId}]`;
}

export function parseScaleSeedOptions(arguments_: readonly string[]): ScaleSeedOptions {
	const [firstArgument] = arguments_;
	const actionCandidate = firstArgument ?? "seed";
	const action = isScaleSeedAction(actionCandidate) ? actionCandidate : "seed";
	const flags = action === firstArgument ? arguments_.slice(1) : arguments_;
	if (!isScaleSeedAction(action)) throw new TypeError(usage());

	let confirmed = false;
	let runId: string | undefined;
	let units: number | undefined;
	let batchSize = DefaultScaleSeedBatchSize;
	let eventsPerUnit = DefaultScaleSeedEventsPerUnit;
	let referenceTime: Date | undefined;
	let distribution: ScaleSeedDistribution = DefaultScaleSeedDistribution;
	let seedOnlyOptionUsed = false;
	for (let position = 0; position < flags.length; position += 1) {
		const flag = flags[position];
		if (flag === "--yes") {
			confirmed = true;
			continue;
		}
		if (flag === "--run-id") {
			runId = parseRunId(requireFlagValue(flags, position, flag));
			position += 1;
			continue;
		}
		if (flag === "--units") {
			seedOnlyOptionUsed = true;
			units = parseBoundedInteger(
				requireFlagValue(flags, position, flag),
				flag,
				1,
				MaxScaleSeedUnits,
			);
			position += 1;
			continue;
		}
		if (flag === "--batch-size") {
			seedOnlyOptionUsed = true;
			batchSize = parseBoundedInteger(
				requireFlagValue(flags, position, flag),
				flag,
				1,
				MaxScaleSeedBatchSize,
			);
			position += 1;
			continue;
		}
		if (flag === "--events-per-unit") {
			seedOnlyOptionUsed = true;
			eventsPerUnit = parseBoundedInteger(
				requireFlagValue(flags, position, flag),
				flag,
				0,
				MaxScaleSeedEventsPerUnit,
			);
			position += 1;
			continue;
		}
		if (flag === "--distribution") {
			seedOnlyOptionUsed = true;
			distribution = parseDistribution(requireFlagValue(flags, position, flag));
			position += 1;
			continue;
		}
		if (flag === "--reference-time") {
			seedOnlyOptionUsed = true;
			referenceTime = parseReferenceTime(requireFlagValue(flags, position, flag));
			position += 1;
			continue;
		}
		throw new TypeError(usage());
	}
	if (!confirmed) throw new Error("Scale seed requires explicit --yes confirmation");
	if (!runId) throw new TypeError("--run-id is required\n" + usage());
	if (action === "purge") {
		if (seedOnlyOptionUsed) throw new TypeError("scale-seed purge accepts only --run-id and --yes");
		return { action, confirmed: true, runId };
	}
	if (units === undefined)
		throw new TypeError("--units is required for scale-seed seed\n" + usage());
	assertSeedTotalEvents(units, eventsPerUnit);
	return {
		action,
		confirmed: true,
		runId,
		units,
		batchSize,
		eventsPerUnit,
		referenceTime: referenceTime ?? new Date(),
		distribution,
	};
}
