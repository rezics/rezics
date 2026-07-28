import { fakerEN, fakerZH_TW, type Faker } from "@faker-js/faker";
import type { PortableText } from "@rezics/portable-text";

import type { EnforcementKindValues } from "../database/schema/contract-values";

export const SeedValue = 20_260_715;

export const DemoCredentials = {
	email: "demo@rezics.test",
	password: "rezics-demo-password",
	apiToken: "rz_api_7f4fbe85d6f14af18d64c8c32de7e821",
} as const;

export const SeedFixtureTitles = {
	book: {
		zh: "種子服務設計手冊",
		en: "Seed Service Design Handbook",
	},
	media: {
		zh: "搜尋索引實戰",
		en: "Search Index Field Notes",
	},
	software: {
		zh: "情境資料工作臺",
		en: "Scenario Data Workbench",
	},
	realm: {
		zh: "REZICS 評分",
		en: "REZICS Score",
	},
	zone: {
		zh: "書庫",
		en: "Book Library",
	},
} as const;

export const SeedPlan = {
	users: 50,
	entities: 75,
	tags: 60,
	books: 80,
	software: 60,
	media: 60,
	series: 20,
	realms: 12,
	zones: 6,
	collections: 75,
	polls: 30,
	rootPosts: 250,
	replies: 400,
	reviews: 120,
	chapters: 100,
	aliases: 800,
	aliasVotes: 1_200,
	credits: 400,
	links: 200,
	unitTags: 1_000,
	tagVotes: 2_000,
	variants: 40,
	seriesReleases: 120,
	softwareRequirements: 120,
	contentStructureNodes: 300,
	pollOptions: 120,
	profileUnitFollows: 300,
	profileBlocks: 50,
	collectionItems: 1_500,
	unitProgress: 1_000,
	contentStructureNodeProgress: 500,
	unitReactions: 3_000,
	unitShares: 1_000,
	scores: 1_500,
	pollVotes: 500,
	realmMembers: 240,
	realmUnitFollows: 300,
	realmRuleRevisions: 12,
	realmRules: 36,
	realmRuleAcceptances: 180,
	realmPins: 72,
	realmUnits: 600,
	capabilityGrants: 80,
	zoneUnitFollows: 150,
	conversations: 100,
	messages: 1_000,
	conversationReads: 200,
	notificationPreferences: 300,
	notifications: 500,
	feedback: 120,
	moderationCases: 60,
	moderationActions: 90,
	accountEnforcements: 20,
	auditEvents: 150,
	recommendationEvents: 10_000,
	recommendationExclusions: 100,
	historyUpdates: 40,
	historyRestores: 10,
} as const;

export const SeedLanguages = ["zh", "en"] as const;
export type SeedLanguage = (typeof SeedLanguages)[number];

const InitialLanguageCycle: readonly SeedLanguage[] = [
	"zh",
	"en",
	"zh",
	"en",
	"en",
	"zh",
	"en",
	"zh",
	"en",
	"en",
	"zh",
	"en",
	"zh",
	"en",
];

const LocalizationCountCycle = [
	1, 2, 1, 1, 2, 1, 2, 1, 2, 1, 1, 2, 1, 2, 1, 2, 2, 1, 2, 1,
] as const;

export interface SeedUnitState {
	status: "draft" | "published" | "archived";
	visibility: "public" | "unlisted" | "private";
	moderationStatus: "approved" | "pending" | "removed";
	publishedAt: Date | null;
}

export interface SeedData {
	readonly referenceTime: Date;
	readonly fakerByLanguage: Readonly<Record<SeedLanguage, Faker>>;
	languages(index: number): readonly SeedLanguage[];
	name(language: SeedLanguage): string;
	title(language: SeedLanguage): string;
	summary(language: SeedLanguage): string;
	portableText(language: SeedLanguage, paragraphs?: number): PortableText;
	pastDate(maxDays: number, minDays?: number): Date;
	futureDate(maxDays: number, minDays?: number): Date;
	unitState(index: number, forcePublished?: boolean): SeedUnitState;
}

function cycleValue<T>(values: readonly T[], index: number): T {
	const value = values[index % values.length];
	if (value === undefined) throw new Error("Seed cycle must not be empty");
	return value;
}

export function createSeedData(referenceTime: Date): SeedData {
	if (Number.isNaN(referenceTime.getTime())) throw new Error("Seed reference time is invalid");
	const fakerByLanguage = {
		zh: fakerZH_TW,
		en: fakerEN,
	} satisfies Record<SeedLanguage, Faker>;
	for (const [index, language] of SeedLanguages.entries()) {
		const languageFaker = fakerByLanguage[language];
		languageFaker.seed(SeedValue + index);
		languageFaker.setDefaultRefDate(referenceTime);
	}
	const generalFaker = fakerByLanguage.en;

	return {
		referenceTime,
		fakerByLanguage,
		languages(index) {
			const initialLanguage = cycleValue(InitialLanguageCycle, index);
			const count = cycleValue(LocalizationCountCycle, index);
			const remaining = SeedLanguages.filter((language) => language !== initialLanguage);
			if (index % 2 === 1) remaining.reverse();
			return [initialLanguage, ...remaining.slice(0, count - 1)];
		},
		name(language) {
			return fakerByLanguage[language].person.fullName();
		},
		title(language) {
			return fakerByLanguage[language].lorem.words({ min: 2, max: 7 }).trim();
		},
		summary(language) {
			return fakerByLanguage[language].lorem.sentences({ min: 1, max: 3 }).trim();
		},
		portableText(language, paragraphs = 2) {
			const languageFaker = fakerByLanguage[language];
			return Array.from({ length: paragraphs }, (_, index) => ({
				_key: languageFaker.string.alphanumeric(12),
				_type: "block",
				style: "normal",
				markDefs: [],
				children: [
					{
						_key: languageFaker.string.alphanumeric(12),
						_type: "span",
						text: languageFaker.lorem.paragraph(),
						marks: index % 4 === 0 ? ["strong"] : [],
					},
				],
			}));
		},
		pastDate(maxDays, minDays = 0) {
			if (maxDays < minDays || minDays < 0) throw new Error("Invalid past date range");
			return generalFaker.date.between({
				from: new Date(referenceTime.getTime() - maxDays * 86_400_000),
				to: new Date(referenceTime.getTime() - minDays * 86_400_000),
			});
		},
		futureDate(maxDays, minDays = 1) {
			if (maxDays < minDays || minDays < 0) throw new Error("Invalid future date range");
			return generalFaker.date.between({
				from: new Date(referenceTime.getTime() + minDays * 86_400_000),
				to: new Date(referenceTime.getTime() + maxDays * 86_400_000),
			});
		},
		unitState(index, forcePublished = false) {
			const stateIndex = index % 100;
			const status = forcePublished
				? "published"
				: stateIndex < 85
					? "published"
					: stateIndex < 93
						? "draft"
						: "archived";
			const visibility = forcePublished
				? "public"
				: stateIndex < 85
					? "public"
					: stateIndex < 95
						? "unlisted"
						: "private";
			const moderationStatus = forcePublished
				? "approved"
				: stateIndex < 94
					? "approved"
					: stateIndex < 98
						? "pending"
						: "removed";
			return {
				status,
				visibility,
				moderationStatus,
				publishedAt: status === "draft" ? null : this.pastDate(730),
			};
		},
	};
}

export function chunks<T>(values: readonly T[], size = 250): T[][] {
	if (!Number.isInteger(size) || size < 1) throw new Error("Chunk size must be positive");
	const result: T[][] = [];
	for (let index = 0; index < values.length; index += size) {
		result.push(values.slice(index, index + size));
	}
	return result;
}

export function collectUnique<T>(count: number, create: () => T, key: (value: T) => string): T[] {
	if (!Number.isInteger(count) || count < 0) throw new Error("Unique count must be non-negative");
	const values = new Map<string, T>();
	const maximumAttempts = Math.max(100, count * 50);
	for (let attempts = 0; values.size < count && attempts < maximumAttempts; attempts += 1) {
		const value = create();
		values.set(key(value), value);
	}
	if (values.size !== count) {
		throw new Error(`Could only create ${values.size} of ${count} unique seed values`);
	}
	return [...values.values()];
}

export function position(index: number): string {
	if (!Number.isInteger(index) || index < 0)
		throw new Error("Position index must be non-negative");
	return index.toString().padStart(8, "0");
}

export function dateOnly(value: Date): string {
	return value.toISOString().slice(0, 10);
}

export function latestDate(first: Date, ...rest: Date[]): Date {
	const timestamps = [first, ...rest].map((value) => value.getTime());
	if (timestamps.some(Number.isNaN)) throw new Error("Cannot order invalid seed dates");
	return new Date(Math.max(...timestamps));
}

interface SeedRealmMemberTarget {
	readonly realmId: string;
	readonly profileId: string;
}

interface SeedRealmUnitTarget {
	readonly realmId: string;
	readonly unitId: string;
}

export type SeedRealmModerationTarget =
	| {
			authority: "realm";
			realmId: string;
			targetKind: "realm_member";
			targetId: string;
	  }
	| {
			authority: "realm";
			realmId: string;
			targetKind: "realm_unit";
			targetId: string;
	  };

export function selectSeedRealmModerationTarget(
	targetKind: SeedRealmModerationTarget["targetKind"],
	index: number,
	targets: {
		readonly members: readonly SeedRealmMemberTarget[];
		readonly units: readonly SeedRealmUnitTarget[];
	},
): SeedRealmModerationTarget {
	if (targetKind === "realm_member") {
		const target = cycleValue(targets.members, index);
		return {
			authority: "realm",
			realmId: target.realmId,
			targetKind,
			targetId: target.profileId,
		};
	}
	const target = cycleValue(targets.units, index);
	return {
		authority: "realm",
		realmId: target.realmId,
		targetKind,
		targetId: target.unitId,
	};
}

type SeedEnforcementKind = (typeof EnforcementKindValues)[number];

export function createSeedEnforcementPlan(input: {
	readonly index: number;
	readonly profileId: string;
	readonly caseId: string;
	readonly actorProfileId: string;
	readonly kind: SeedEnforcementKind;
	readonly startsAt: Date;
	readonly expiresAt: Date | null;
}) {
	const suffix = position(input.index);
	return {
		action: {
			caseId: input.caseId,
			actorProfileId: input.actorProfileId,
			kind: input.kind,
			reasonCode: "administrative" as const,
			requestId: `seed-enforcement-request-${suffix}`,
			idempotencyKey: `seed-enforcement-${suffix}`,
			createdAt: input.startsAt,
		},
		enforcement: {
			profileId: input.profileId,
			kind: input.kind,
			startsAt: input.startsAt,
			expiresAt: input.expiresAt,
			createdAt: input.startsAt,
			updatedAt: input.startsAt,
		},
	};
}

export function assertLocalDatabaseUrl(value: string): void {
	const hostname = new URL(value).hostname;
	if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname)) {
		throw new Error(`Refusing to seed non-local database host: ${hostname}`);
	}
}
