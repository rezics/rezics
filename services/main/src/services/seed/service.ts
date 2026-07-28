import { createHash } from "node:crypto";

import {
	createCollectionPresentationDocument,
	createDockDocument,
	createManualCollectionDefinitionDocument,
	createPollContentBlock,
	createPortableTextDocument,
	createUnitReferencedBlockDocument,
	createSystemCollectionDefinitionDocument,
	createZoneBoundaryDocument,
	createZoneThemeDocument,
	assertWikiPostPortableTextDocument,
} from "@rezics/block";
import { defaultKeyHasher } from "@better-auth/api-key";
import { hashPassword } from "better-auth/crypto";
import { and, eq, isNull, notInArray, sql } from "drizzle-orm";
import { OfficialRealmUnitIds, ZoneHomePageSlug } from "@rezics/slug";
import { PlatformCapabilityValues } from "@rezics/access";

import { env } from "../config";
import { Authorization } from "../authorization";
import {
	BootstrapAuthUserIds,
	BootstrapUnitIds,
	OfficialProfileIds,
	OfficialRealmManifest,
	OfficialZoneAvatarAsset,
	TopLevelSlugNamespaceUnitIds,
} from "../bootstrap/manifest";
import { databaseBootstrapService } from "../bootstrap/service";
import { ApiPermissionValues, toApiKeyPermissions } from "../auth/api-permissions";
import { database, type DatabaseTransaction } from "../database";
import { createGovernanceNotePost } from "../governance/note-service";
import { isFirstUnitLocalization } from "../units/localization";
import {
	accountEnforcement,
	accounts,
	apikeys,
	auditEvent,
	book,
	catalogUnitContentLicense,
	platformCapabilityGrant,
	collection,
	collectionItem,
	contentStructure,
	contentStructureNode,
	contentStructureNodeProgress,
	conversation,
	conversationRead,
	entity,
	EnforcementKindValues,
	feedback,
	label,
	software,
	softwareRequirement,
	media,
	message,
	moderationAction,
	moderationCase,
	notification,
	notificationPreference,
	poll,
	pollOption,
	pollVote,
	post,
	postReply,
	postScore,
	profile,
	profileBlock,
	profileRealmTagSubscription,
	unitFollow,
	profilePreference,
	profileUnitTag,
	realm,
	realmUnit,
	realmMember,
	realmPin,
	realmRule,
	realmRuleAcceptance,
	realmRuleRevision,
	realmScoreContext,
	realmTagContext,
	realmTagVote,
	realmUnitTag,
	recommendationEvent,
	recommendationExclusion,
	release,
	score,
	series,
	seriesRelease,
	tag,
	unit,
	unitAccessInvitation,
	unitAlias,
	unitAliasVote,
	unitAccessGrant,
	unitAccessRestriction,
	unitAssociationProposal,
	creditAttribution,
	CommunityCatalogUnitKindValues,
	unitOwnership,
	unitLink,
	unitLocalization,
	unitDock,
	unitSlugAddress,
	unitProgress,
	unitReaction,
	unitShare,
	unitStatusEvent,
	subjectAssociation,
	unitTag,
	unitTagVote,
	unitVariant,
	users,
	zone,
	zonePage,
} from "../database/schema";
import { createNavigationStructure } from "../content-structure/navigation";
import { createContentStructure, insertContentStructureNode } from "../content-structure/service";
import {
	createContentStructureHistory,
	getContentStructureHeadRevision,
} from "../content-structure/history";
import { loadContentStructureSnapshot } from "../content-structure/storage";
import { createDockHistory, getDockRevisionId } from "../api/docks/history";
import { RecommendationPolicyVersion } from "../recommendations/policy";
import { fractionalPositionAt } from "../ordering/position";
import { recordUnitRevision, restoreUnitRevision } from "../units/history";
import { replaceZonePageSlugAddress } from "../units/slug-address";
import { ensureOfficialZoneFollows } from "../bootstrap/official-zone-follows";
import { bindStandardPolicyToToken } from "../auth/api-token/policy-service";
import { createSharedSearchQuery } from "../search/shared-queries";
import { createTagStructureInTransaction } from "../tag-structures/service";
import {
	assertLocalDatabaseUrl,
	chunks,
	collectUnique,
	createSeedData,
	createSeedEnforcementPlan,
	dateOnly,
	DemoCredentials,
	latestDate,
	position,
	selectSeedRealmModerationTarget,
	SeedPlan,
	SeedFixtureTitles,
	type SeedData,
} from "./data";
import { createSeedRunOptions, includesSeedScenario, type SeedRunOptions } from "./contracts";

type UnitKind = (typeof unit.$inferSelect)["kind"];
type UnitStatus = (typeof unit.$inferSelect)["status"];
type UnitVisibility = (typeof unit.$inferSelect)["visibility"];
type ModerationStatus = (typeof unit.$inferSelect)["moderationStatus"];

type LocalizationKind = "description" | "post" | "reply" | "poll" | "title";

interface UnitDescriptor {
	kind: UnitKind;
	seedKey: string;
	ownerProfileId: string;
	localizationKind: LocalizationKind;
	status: UnitStatus;
	visibility: UnitVisibility;
	moderationStatus: ModerationStatus;
	publishedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

interface CreatedUnit extends UnitDescriptor {
	id: string;
}

interface CreatedProfile {
	id: string;
	authUserId: string;
	name: string;
	email: string;
	createdAt: Date;
}

interface CreatedAlias {
	id: string;
	unitId: string;
}

interface CreatedLink {
	id: string;
	unitId: string;
}

interface CreatedNode {
	id: string;
	ownerUnitId: string;
	contentUnitId: string;
	createdAt: Date;
}

interface CreatedConversation {
	id: string;
	lowId: string;
	highId: string;
}

function itemAt<T>(values: readonly T[], index: number): T {
	if (values.length === 0) throw new Error("Cannot choose from an empty seed collection");
	const value = values[index % values.length];
	if (value === undefined) throw new Error("Seed collection lookup failed");
	return value;
}

async function writeBatches<T>(
	values: readonly T[],
	write: (batch: T[]) => Promise<unknown>,
): Promise<void> {
	for (const batch of chunks(values)) await write(batch);
}

function createdAtFor(data: SeedData, maximumAgeDays = 730): Date {
	return data.pastDate(maximumAgeDays);
}

function createDescriptor(
	data: SeedData,
	input: {
		kind: UnitKind;
		seedKey: string;
		ownerProfileId: string;
		localizationKind?: LocalizationKind;
		stateIndex: number;
		maximumAgeDays?: number;
		forcePublished?: boolean;
		notBefore?: readonly Date[];
	},
): UnitDescriptor {
	const createdAt = latestDate(
		createdAtFor(data, input.maximumAgeDays),
		...(input.notBefore ?? []),
	);
	const state = data.unitState(input.stateIndex, input.forcePublished);
	return {
		kind: input.kind,
		seedKey: input.seedKey,
		ownerProfileId: input.ownerProfileId,
		localizationKind: input.localizationKind ?? "description",
		status: state.status,
		visibility: state.visibility,
		moderationStatus: state.moderationStatus,
		publishedAt: state.status === "draft" ? null : createdAt,
		createdAt,
		updatedAt: createdAt,
	};
}

async function insertUnits(
	tx: DatabaseTransaction,
	descriptors: readonly UnitDescriptor[],
): Promise<CreatedUnit[]> {
	const created: CreatedUnit[] = [];
	for (const descriptor of descriptors) {
		const [row] = await tx
			.insert(unit)
			.values({
				kind: descriptor.kind,
				status: descriptor.status,
				visibility: descriptor.visibility,
				moderationStatus: descriptor.moderationStatus,
				publishedAt: descriptor.publishedAt,
				createdAt: descriptor.createdAt,
				updatedAt: descriptor.updatedAt,
			})
			.returning({ id: unit.id });
		if (!row) throw new Error(`Seed Unit insertion did not return ${descriptor.seedKey}`);
		await tx.insert(unitStatusEvent).values({
			unitId: row.id,
			fromStatus: null,
			toStatus: descriptor.status,
			actorKind: "system",
			changedByProfileId: null,
			createdAt: descriptor.createdAt,
		});
		created.push({ ...descriptor, id: row.id });
	}
	return created;
}

function localizationRows(data: SeedData, value: CreatedUnit) {
	return data.languages(Number(value.seedKey.match(/\d+$/)?.[0] ?? 0)).map((language, index) => {
		const contentStatus =
			value.status === "published"
				? ("published" as const)
				: value.status === "archived"
					? ("archived" as const)
					: ("draft" as const);
		const base = {
			unitId: value.id,
			language,
			position: fractionalPositionAt(index),
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		};
		switch (value.localizationKind) {
			case "reply":
				return {
					...base,
					content: createPortableTextDocument(data.portableText(language, 1)),
					contentStatus,
				};
			case "post":
				return {
					...base,
					title: data.title(language),
					summary: data.summary(language),
					content: createPortableTextDocument(data.portableText(language, 2)),
					contentStatus,
				};
			case "poll":
				return { ...base, title: data.title(language), summary: data.summary(language) };
			case "title":
				return { ...base, title: data.title(language) };
			case "description":
				return {
					...base,
					title: data.title(language),
					summary: data.summary(language),
					description: createPortableTextDocument(data.portableText(language, 2)),
				};
		}
	});
}

async function insertUnitDetails(
	tx: DatabaseTransaction,
	data: SeedData,
	values: readonly CreatedUnit[],
	communityOwnerProfileId: string = OfficialProfileIds.community,
): Promise<void> {
	await writeBatches(
		values.flatMap((value) => localizationRows(data, value)),
		(batch) => tx.insert(unitLocalization).values(batch),
	);
	const ownershipRows: (typeof unitOwnership.$inferInsert)[] = [];
	const grantRows: (typeof unitAccessGrant.$inferInsert)[] = [];
	const communityCatalogKinds: ReadonlySet<string> = new Set(CommunityCatalogUnitKindValues);
	for (const value of values) {
		const ownershipCommon = {
			unitId: value.id,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		};
		if (value.kind === "entity") {
			ownershipRows.push({
				...ownershipCommon,
				profileId: value.ownerProfileId,
				assignedByProfileId: value.ownerProfileId,
			});
			for (const permission of [
				"entity.association.credit.request",
				"entity.association.subject.request",
				"entity.association.subject.direct",
			] as const)
				grantRows.push({
					unitId: value.id,
					subjectKind: "authenticated",
					permission,
					scope: [],
					grantedByProfileId: value.ownerProfileId,
					createdAt: value.createdAt,
					updatedAt: value.updatedAt,
				});
		} else if (communityCatalogKinds.has(value.kind)) {
			ownershipRows.push({
				...ownershipCommon,
				profileId: communityOwnerProfileId,
				assignedByProfileId: communityOwnerProfileId,
			});
			for (const permission of [
				"unit.read",
				"unit.update",
				...(value.kind === "tag" ? [] : (["unit.status.update"] as const)),
			] as const)
				grantRows.push({
					unitId: value.id,
					subjectKind: "profile",
					profileId: value.ownerProfileId,
					permission,
					scope: [],
					grantedByProfileId: communityOwnerProfileId,
					createdAt: value.createdAt,
					updatedAt: value.updatedAt,
				});
		} else {
			ownershipRows.push({
				...ownershipCommon,
				profileId: value.ownerProfileId,
				assignedByProfileId: value.ownerProfileId,
			});
			if (value.kind === "realm")
				for (const permission of ["unit.read", "realm.contribute"] as const)
					grantRows.push({
						unitId: value.id,
						subjectKind: "realm",
						realmId: value.id,
						permission,
						scope: [],
						grantedByProfileId: value.ownerProfileId,
						createdAt: value.createdAt,
						updatedAt: value.updatedAt,
					});
		}
	}
	await writeBatches(ownershipRows, (batch) => tx.insert(unitOwnership).values(batch));
	await writeBatches(grantRows, (batch) => tx.insert(unitAccessGrant).values(batch));
}

async function seedProfiles(
	tx: DatabaseTransaction,
	data: SeedData,
	demoPasswordHash: string,
): Promise<CreatedProfile[]> {
	const userInputs = Array.from({ length: SeedPlan.users }, (_, index) => {
		const language = itemAt(data.languages(index), 0);
		const createdAt = data.pastDate(1_460);
		return {
			name: index === 0 ? "REZICS Demo" : data.name(language),
			email:
				index === 0 ? DemoCredentials.email : `seed-user-${position(index)}@example.test`,
			emailVerified: index === 0 || index % 5 !== 0,
			image: index === 0 ? null : data.fakerByLanguage[language].image.avatar(),
			createdAt,
			updatedAt: createdAt,
		};
	});
	const returnedUsers: (typeof users.$inferSelect)[] = [];
	for (const batch of chunks(userInputs)) {
		returnedUsers.push(...(await tx.insert(users).values(batch).returning()));
	}
	const userByEmail = new Map(returnedUsers.map((value) => [value.email, value]));
	const profileDescriptors = userInputs.map((input, index) => ({
		kind: "profile" as const,
		seedKey: index === 0 ? "demo" : `seed-profile-${position(index)}`,
		ownerProfileId: "",
		localizationKind: "description" as const,
		status: "published" as const,
		visibility: "public" as const,
		moderationStatus: "approved" as const,
		publishedAt: input.createdAt,
		createdAt: input.createdAt,
		updatedAt: input.updatedAt,
	}));
	const profileUnits = await insertUnits(tx, profileDescriptors);
	const profiles = profileUnits.map((profileUnit, index): CreatedProfile => {
		const input = itemAt(userInputs, index);
		const authUser = userByEmail.get(input.email);
		if (!authUser) throw new Error(`Auth User insertion did not return ${input.email}`);
		return {
			id: profileUnit.id,
			authUserId: authUser.id,
			name: input.name,
			email: input.email,
			createdAt: input.createdAt,
		};
	});
	await writeBatches(
		profiles.map((value) => {
			return {
				id: value.id,
				authUserId: value.authUserId,
				joinedAt: value.createdAt,
				createdAt: value.createdAt,
				updatedAt: value.createdAt,
			};
		}),
		(batch) => tx.insert(profile).values(batch),
	);
	await writeBatches(
		profiles.map((value) => ({
			unitId: value.id,
			profileId: value.id,
			assignedByProfileId: value.id,
			createdAt: value.createdAt,
			updatedAt: value.createdAt,
		})),
		(batch) => tx.insert(unitOwnership).values(batch),
	);
	await writeBatches(
		profiles.map((value, index) => {
			const language = itemAt(data.languages(index), 0);
			return {
				unitId: value.id,
				language,
				position: fractionalPositionAt(0),
				title: value.name,
				summary: data.summary(language),
				description: createPortableTextDocument(data.portableText(language, 2)),
				createdAt: value.createdAt,
				updatedAt: value.createdAt,
			};
		}),
		(batch) => tx.insert(unitLocalization).values(batch),
	);
	await writeBatches(
		profiles.map((value, index) => {
			const contentLanguage = itemAt(data.languages(index), 0);
			const interfaceLocale =
				contentLanguage === "zh" ? ("zh-Hant" as const) : contentLanguage;
			return {
				profileId: value.id,
				interfaceLocale,
				defaultLicense: index % 3 === 0 ? ("cc-by-4.0" as const) : null,
				defaultScoreContextUnitId: OfficialRealmUnitIds.score,
				personalizedFeed: index % 10 !== 0 || index === 0,
				contentRatings:
					index % 7 === 0 ? ["general" as const, "r15" as const] : ["general" as const],
				preferredLanguages: [...data.languages(index)],
				collectionConfig: {
					version: 1,
					view: index % 2 === 0 ? "grid" : "list",
					addMainWithVariantByDefault: index % 3 !== 0,
				},
				createdAt: value.createdAt,
				updatedAt: value.createdAt,
			};
		}),
		(batch) => tx.insert(profilePreference).values(batch),
	);
	await writeBatches(
		profiles.map((value) => ({
			realmId: OfficialRealmUnitIds.score,
			profileId: value.id,
			state: "active" as const,
			joinedAt: value.createdAt,
			updatedAt: value.createdAt,
		})),
		(batch) => tx.insert(realmMember).values(batch),
	);
	const demo = itemAt(profiles, 0);
	await tx.insert(accounts).values({
		accountId: demo.authUserId,
		providerId: "credential",
		userId: demo.authUserId,
		password: demoPasswordHash,
		createdAt: demo.createdAt,
		updatedAt: demo.createdAt,
	});
	await tx.insert(apikeys).values({
		configId: "default",
		name: "Seed demo token",
		start: DemoCredentials.apiToken.slice(0, 14),
		referenceId: demo.authUserId,
		prefix: "rz_api_",
		key: await defaultKeyHasher(DemoCredentials.apiToken),
		enabled: true,
		rateLimitEnabled: true,
		rateLimitTimeWindow: 60_000,
		rateLimitMax: 300,
		requestCount: 0,
		permissions: JSON.stringify(toApiKeyPermissions(ApiPermissionValues)),
		createdAt: demo.createdAt,
		updatedAt: demo.createdAt,
	});
	return profiles;
}

interface SeedCatalog {
	entities: CreatedUnit[];
	tags: CreatedUnit[];
	books: CreatedUnit[];
	softwareUnits: CreatedUnit[];
	media: CreatedUnit[];
	works: CreatedUnit[];
	series: CreatedUnit[];
	realms: CreatedUnit[];
	zones: CreatedUnit[];
	collections: CreatedUnit[];
	polls: CreatedUnit[];
	links: CreatedLink[];
}

interface SeedContent {
	rootPosts: CreatedUnit[];
	replies: CreatedUnit[];
	reviews: CreatedUnit[];
	chapters: CreatedUnit[];
	allPosts: CreatedUnit[];
	nodes: CreatedNode[];
}

interface SeedStructure {
	readonly realmMembers: readonly { realmId: string; profileId: string }[];
	readonly realmUnits: readonly { realmId: string; unitId: string }[];
}

async function seedOfficialZoneCatalogFixtures(
	tx: DatabaseTransaction,
	data: SeedData,
	input: {
		readonly book: CreatedUnit;
		readonly media: CreatedUnit;
		readonly software: CreatedUnit;
	},
): Promise<void> {
	const fixtures = [
		["book", input.book],
		["media", input.media],
		["software", input.software],
	] as const;
	for (const [kind, value] of fixtures) {
		const titles = SeedFixtureTitles[kind];
		await tx
			.insert(unitLocalization)
			.values(
				(["zh", "en"] as const).map((language, index) => ({
					unitId: value.id,
					language,
					position: fractionalPositionAt(index),
					title: titles[language],
					summary:
						language === "zh"
							? "用來驗證官方資料庫搜尋、分面與內容動態的固定情境資料。"
							: "Stable scenario content for official library search, facets, and feeds.",
					description: createPortableTextDocument(data.portableText(language, 2)),
					createdAt: value.createdAt,
					updatedAt: value.updatedAt,
				})),
			)
			.onConflictDoUpdate({
				target: [unitLocalization.unitId, unitLocalization.language],
				set: {
					title: sql`excluded.title`,
					summary: sql`excluded.summary`,
					description: sql`excluded.description`,
					position: sql`excluded.position`,
					updatedAt: sql`excluded.updated_at`,
				},
			});
	}
}

async function seedCatalog(
	tx: DatabaseTransaction,
	data: SeedData,
	profiles: readonly CreatedProfile[],
): Promise<SeedCatalog> {
	let stateIndex = 0;
	const descriptors = (
		kind: UnitKind,
		count: number,
		prefix: string,
		maximumAgeDays = 730,
		localizationKind: LocalizationKind = "description",
	) =>
		Array.from({ length: count }, (_, index) => {
			const owner = itemAt(profiles, index);
			return createDescriptor(data, {
				kind,
				seedKey: index === 0 ? `demo-${prefix}` : `seed-${prefix}-${position(index)}`,
				ownerProfileId: owner.id,
				localizationKind,
				stateIndex: stateIndex++,
				maximumAgeDays,
				forcePublished: index === 0,
				notBefore: [owner.createdAt],
			});
		});

	const entities = await insertUnits(tx, descriptors("entity", SeedPlan.entities, "entity"));
	const tags = await insertUnits(tx, descriptors("tag", SeedPlan.tags, "tag"));
	const books = await insertUnits(tx, descriptors("book", SeedPlan.books, "book"));
	const softwareUnits = await insertUnits(
		tx,
		descriptors("software", SeedPlan.software, "software"),
	);
	const mediaItems = await insertUnits(tx, descriptors("media", SeedPlan.media, "media"));
	const seriesItems = await insertUnits(tx, descriptors("series", SeedPlan.series, "series"));
	const realms = await insertUnits(tx, descriptors("realm", SeedPlan.realms, "realm"));

	const zoneDescriptors = descriptors("zone", SeedPlan.zones, "zone");
	const zones = await insertUnits(tx, zoneDescriptors);
	const collectionDescriptors = Array.from({ length: SeedPlan.collections }, (_, index) => {
		const owner = itemAt(profiles, index);
		const createdAt = latestDate(data.pastDate(730), owner.createdAt);
		if (index < SeedPlan.users) {
			return {
				kind: "collection" as const,
				seedKey: `favorites-${position(index)}`,
				ownerProfileId: owner.id,
				localizationKind: "description" as const,
				status: "published" as const,
				visibility: "private" as const,
				moderationStatus: "approved" as const,
				publishedAt: createdAt,
				createdAt,
				updatedAt: createdAt,
			};
		}
		return createDescriptor(data, {
			kind: "collection",
			seedKey: `seed-collection-${position(index - SeedPlan.users)}`,
			ownerProfileId: owner.id,
			stateIndex: stateIndex++,
			maximumAgeDays: 730,
			forcePublished: index === SeedPlan.users,
			notBefore: [owner.createdAt],
		});
	});
	const collections = await insertUnits(tx, collectionDescriptors);
	const pollDescriptors = descriptors("poll", SeedPlan.polls, "poll", 180, "poll");
	const polls = await insertUnits(tx, pollDescriptors);
	const allUnits = [
		...entities,
		...tags,
		...books,
		...softwareUnits,
		...mediaItems,
		...seriesItems,
		...realms,
		...zones,
		...collections,
		...polls,
	];
	await writeBatches(
		realms.map((value, index) => ({
			id: value.id,
			joinPolicy: index % 3 === 0 ? ("approval" as const) : ("open" as const),
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(realm).values(batch),
	);
	await insertUnitDetails(tx, data, allUnits, OfficialProfileIds.community);
	const [fixtureBook, fixtureMedia, fixtureSoftware] = [
		books[0],
		mediaItems[0],
		softwareUnits[0],
	];
	if (!fixtureBook || !fixtureMedia || !fixtureSoftware)
		throw new Error("Official Zone catalog scenarios require Book, Media, and Software Units");
	await seedOfficialZoneCatalogFixtures(tx, data, {
		book: fixtureBook,
		media: fixtureMedia,
		software: fixtureSoftware,
	});

	await writeBatches(
		entities.map((value, index) => ({
			id: value.id,
			kind: index < 45 ? "person" : index < 65 ? "organization" : "platform",
			verified: false,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(entity).values(batch),
	);
	await writeBatches(
		tags.map((value) => ({
			id: value.id,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(tag).values(batch),
	);
	await writeBatches(
		books.map((value, index) => ({
			id: value.id,
			isbn13: data.fakerByLanguage.en.string.numeric(13),
			publicationDate: dateOnly(data.pastDate(7_300)),
			pageCount: 80 + ((index * 37) % 900),
			format: itemAt(["paperback", "hardcover", "ebook"], index),
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(book).values(batch),
	);
	await writeBatches(
		softwareUnits.map((value, index) => ({
			id: value.id,
			releaseDate: dateOnly(data.pastDate(5_000)),
			versionLabel: `${1 + (index % 5)}.${index % 10}`,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(software).values(batch),
	);
	await writeBatches(
		mediaItems.map((value, index) => ({
			id: value.id,
			kind: itemAt(["movie", "series", "animation", "documentary"], index),
			releaseDate: dateOnly(data.pastDate(7_300)),
			runtimeMinutes: 20 + ((index * 17) % 180),
			episodeCount: index % 3 === 0 ? 1 + (index % 48) : null,
			seasonCount: index % 3 === 0 ? 1 + (index % 8) : null,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(media).values(batch),
	);
	await writeBatches(
		[
			...books
				.filter((_, index) => index % 3 === 0)
				.map((value) => ({
					unitId: value.id,
					unitKind: "book" as const,
					createdAt: value.createdAt,
				})),
			...softwareUnits
				.filter((_, index) => index % 4 === 0)
				.map((value) => ({
					unitId: value.id,
					unitKind: "software" as const,
					createdAt: value.createdAt,
				})),
			...mediaItems
				.filter((_, index) => index % 5 === 0)
				.map((value) => ({
					unitId: value.id,
					unitKind: "media" as const,
					createdAt: value.createdAt,
				})),
		],
		(batch) => tx.insert(catalogUnitContentLicense).values(batch),
	);
	await writeBatches(
		seriesItems.map((value, index) => ({
			id: value.id,
			kind: itemAt(["franchise", "book_series", "software_series", "media_series"], index),
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(series).values(batch),
	);
	await writeBatches(
		realms.map((value) => ({
			ownerUnitId: value.id,
			kind: "realm.taxonomy" as const,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(contentStructure).values(batch),
	);
	await writeBatches(
		zones.map((value, index) => ({
			id: value.id,
			boundaryDocument: createZoneBoundaryDocument(["units"]),
			themeDocument: createZoneThemeDocument({
				accent: itemAt(["#f59e0b", "#3b82f6", "#8b5cf6"], index),
			}),
			startsAt: index % 3 === 0 ? data.pastDate(180) : null,
			endsAt: index % 3 === 0 ? data.futureDate(180) : null,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(zone).values(batch),
	);
	await writeBatches(
		zones.map((value) => ({
			unitId: value.id,
			kind: "main" as const,
			document: createDockDocument(),
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(unitDock).values(batch),
	);
	await writeBatches(
		collections.map((value, index) => {
			const favorites = index < SeedPlan.users;
			return {
				id: value.id,
				ownerProfileId: value.ownerProfileId,
				source: favorites ? ("system" as const) : ("manual" as const),
				systemKey: favorites ? ("favorites" as const) : null,
				definitionDocument: favorites
					? createSystemCollectionDefinitionDocument("favorites")
					: createManualCollectionDefinitionDocument(),
				presentationDocument: createCollectionPresentationDocument(),
				createdAt: value.createdAt,
				updatedAt: value.updatedAt,
			};
		}),
		(batch) => tx.insert(collection).values(batch),
	);
	await writeBatches(
		polls.map((value, index) => {
			const closesAt =
				index % 5 === 0 ? new Date(value.createdAt.getTime() + 30 * 86_400_000) : null;
			return {
				id: value.id,
				mode: index % 3 === 0 ? ("multiple" as const) : ("single" as const),
				resultVisibility: index % 4 === 0 ? ("after_close" as const) : ("live" as const),
				anonymous: index % 5 === 0,
				closesAt,
				closedAt: closesAt && index % 10 === 0 ? closesAt : null,
				createdAt: value.createdAt,
				updatedAt: value.updatedAt,
			};
		}),
		(batch) => tx.insert(poll).values(batch),
	);

	const works = [...books, ...softwareUnits, ...mediaItems];
	const aliases = Array.from({ length: SeedPlan.aliases }, (_, index) => {
		const target = itemAt(
			[...entities, ...tags, ...works, ...seriesItems, ...realms, ...zones],
			index,
		);
		const ordinal = Math.floor(index / (entities.length + tags.length + works.length));
		const value = `${target.seedKey.replaceAll("-", " ")} ${ordinal + 1}`;
		return {
			unitId: target.id,
			term: value,
			normalizedTerm: value.normalize("NFKC").toLowerCase(),
			language: itemAt(data.languages(index), 0),
			kind: itemAt(["common", "abbreviation", "alternate_title"] as const, index),
			createdByProfileId: itemAt(profiles, index).id,
			createdAt: target.createdAt,
			updatedAt: target.updatedAt,
		};
	});
	const returnedAliases: CreatedAlias[] = [];
	for (const batch of chunks(aliases)) {
		returnedAliases.push(
			...(await tx
				.insert(unitAlias)
				.values(batch)
				.returning({ id: unitAlias.id, unitId: unitAlias.unitId })),
		);
	}
	const aliasVotes = collectUnique(
		SeedPlan.aliasVotes,
		() => ({
			alias: data.fakerByLanguage.en.helpers.arrayElement(returnedAliases),
			profile: data.fakerByLanguage.en.helpers.arrayElement(profiles),
		}),
		({ alias, profile: voter }) => `${alias.id}:${voter.id}`,
	).map(({ alias, profile: voter }, index) => ({
		aliasId: alias.id,
		profileId: voter.id,
		value: index % 5 === 0 ? -1 : 1,
	}));
	await writeBatches(aliasVotes, (batch) => tx.insert(unitAliasVote).values(batch));

	await writeBatches(
		Array.from({ length: SeedPlan.credits }, (_, index) => ({
			sourceUnitId: itemAt(works, Math.floor(index / 2)).id,
			creditedUnitId: itemAt(entities, index * 7).id,
			role: itemAt(["author", "developer", "director", "publisher"] as const, index),
			position: fractionalPositionAt(index),
		})),
		(batch) => tx.insert(creditAttribution).values(batch),
	);
	const linkInputs = Array.from({ length: SeedPlan.links }, (_, index) => {
		const target = itemAt(works, index);
		const url = `https://example.test/catalog/${target.id}`;
		return {
			unitId: target.id,
			sourceEntityId: itemAt(entities, index).id,
			url,
			normalizedUrl: url,
			normalizedUrlHash: createHash("sha256").update(url).digest("hex"),
			role: "official",
			position: fractionalPositionAt(index),
		};
	});
	const links: CreatedLink[] = [];
	for (const batch of chunks(linkInputs)) {
		links.push(
			...(await tx
				.insert(unitLink)
				.values(batch)
				.returning({ id: unitLink.id, unitId: unitLink.unitId })),
		);
	}
	const tagRows = Array.from({ length: SeedPlan.unitTags }, (_, index) => ({
		unitId: itemAt(works, Math.floor(index / 5)).id,
		tagId: itemAt(tags, index * 7).id,
		pinned: index % 11 === 0,
		position: fractionalPositionAt(index),
	}));
	await writeBatches(tagRows, (batch) => tx.insert(unitTag).values(batch));
	await writeBatches(
		Array.from({ length: SeedPlan.tagVotes }, (_, index) => {
			const tagged = itemAt(tagRows, Math.floor(index / 2));
			return {
				unitId: tagged.unitId,
				tagId: tagged.tagId,
				profileId: itemAt(profiles, index + Math.floor(index / 2)).id,
				value: index % 7 === 0 ? -1 : 1,
			};
		}),
		(batch) => tx.insert(unitTagVote).values(batch),
	);
	await writeBatches(
		Array.from({ length: SeedPlan.variants }, (_, index) => {
			const groups = [
				{ kind: "book" as const, units: books },
				{ kind: "software" as const, units: softwareUnits },
				{ kind: "media" as const, units: mediaItems },
			];
			const group = itemAt(groups, index);
			const ordinal = Math.floor(index / groups.length);
			return {
				variantUnitId: itemAt(group.units, group.units.length - 1 - ordinal).id,
				mainUnitId: itemAt(group.units, ordinal).id,
				unitKind: group.kind,
			};
		}),
		(batch) => tx.insert(unitVariant).values(batch),
	);
	await writeBatches(
		Array.from({ length: SeedPlan.seriesReleases }, (_, index) => ({
			seriesId: itemAt(seriesItems, Math.floor(index / 6)).id,
			releaseUnitId: itemAt(works, index * 7).id,
			position: fractionalPositionAt(index % 6),
			releasedOn: dateOnly(data.pastDate(3_650)),
		})),
		(batch) => tx.insert(seriesRelease).values(batch),
	);
	const linkByUnitId = new Map(links.map((value) => [value.unitId, value]));
	await writeBatches(
		Array.from({ length: SeedPlan.softwareRequirements }, (_, index) => {
			const softwareUnit = itemAt(softwareUnits, Math.floor(index / 2));
			return {
				softwareId: softwareUnit.id,
				platformEntityId: itemAt(entities.slice(65), index).id,
				tier: index % 2 === 0 ? "minimum" : "recommended",
				sourceLinkId: linkByUnitId.get(softwareUnit.id)?.id,
				hardware: {
					memoryGb: index % 2 === 0 ? 8 : 16,
					storageGb: 40 + (index % 8) * 10,
				},
			};
		}),
		(batch) => tx.insert(softwareRequirement).values(batch),
	);
	const createdPollOptions: { id: string; pollId: string; position: number }[] = [];
	for (const batch of chunks(
		Array.from({ length: SeedPlan.pollOptions }, (_, index) => {
			const pollUnit = itemAt(polls, Math.floor(index / 4));
			return {
				pollId: pollUnit.id,
				sourceKind: "literal" as const,
				targetUnitId: null,
				position: index % 4,
				createdAt: pollUnit.createdAt,
				updatedAt: pollUnit.updatedAt,
			};
		}),
	)) {
		createdPollOptions.push(
			...(await tx.insert(pollOption).values(batch).returning({
				id: pollOption.id,
				pollId: pollOption.pollId,
				position: pollOption.position,
			})),
		);
	}
	for (const pollUnit of polls) {
		const options = createdPollOptions
			.filter((option) => option.pollId === pollUnit.id)
			.sort((left, right) => left.position - right.position);
		for (const language of data.languages(Number(pollUnit.seedKey.match(/\d+$/)?.[0] ?? 0))) {
			await tx
				.update(unitLocalization)
				.set({
					content: createPollContentBlock(
						options.map((option) => ({
							optionId: option.id,
							label: data.title(language),
						})),
					),
					contentStatus: pollUnit.status === "published" ? "published" : "draft",
				})
				.where(
					and(
						eq(unitLocalization.unitId, pollUnit.id),
						eq(unitLocalization.language, language),
					),
				);
		}
	}

	return {
		entities,
		tags,
		books,
		softwareUnits,
		media: mediaItems,
		works,
		series: seriesItems,
		realms,
		zones,
		collections,
		polls,
		links,
	};
}

function toaruWikiBody(language: "zh" | "en") {
	const copy =
		language === "zh"
			? {
					heading: "歡迎來到魔法禁書目錄中文維基",
					intro: "這裡整理《魔法禁書目錄》及其科學側衍生作品的世界觀、人物與作品資料。",
					guide: "第一次來到本站？從作品導覽與世界觀條目開始探索。",
					sections: ["作品與系列", "角色與組織", "世界觀與術語"],
				}
			: {
					heading: "Welcome to the A Certain Magical Index Wiki",
					intro: "Explore the setting, characters, and works of A Certain Magical Index and its science-side spin-offs.",
					guide: "New here? Start with the reading guide and the overview of the setting.",
					sections: [
						"Works and series",
						"Characters and groups",
						"Setting and terminology",
					],
				};
	const text = (
		key: string,
		spanKey: string,
		value: string,
		style: "normal" | "h2" = "normal",
	) => ({
		_type: "block" as const,
		_key: key,
		style,
		markDefs: [],
		children: [{ _type: "span" as const, _key: spanKey, text: value, marks: [] }],
	});
	const body = createPortableTextDocument(
		[
			text("a00000000001", "a00000000002", copy.heading, "h2"),
			{
				_type: "columns",
				_key: "a00000000003",
				columns: [
					{
						_key: "a00000000004",
						weight: 7,
						blocks: [
							createPortableTextDocument(
								[text("a00000000006", "a00000000007", copy.intro)],
								"a00000000005",
							),
						],
					},
					{
						_key: "a00000000008",
						weight: 3,
						blocks: [
							createPortableTextDocument(
								[text("a0000000000a", "a0000000000b", copy.guide)],
								"a00000000009",
							),
						],
					},
				],
			},
			{ _type: "divider", _key: "a0000000000c", style: "section" },
			{
				_type: "columns",
				_key: "a0000000000d",
				columns: copy.sections.map((section, index) => ({
					_key: ["a0000000000e", "a00000000012", "a00000000016"][index]!,
					weight: 1,
					blocks: [
						createPortableTextDocument(
							[
								text(
									["a00000000010", "a00000000014", "a00000000018"][index]!,
									["a00000000011", "a00000000015", "a00000000019"][index]!,
									section,
									"h2",
								),
							],
							["a0000000000f", "a00000000013", "a00000000017"][index]!,
						),
					],
				})),
			},
		],
		"a00000000000",
	);
	assertWikiPostPortableTextDocument(body);
	return body;
}

async function seedToaruWiki(
	tx: DatabaseTransaction,
	data: SeedData,
	profiles: readonly CreatedProfile[],
	catalog: SeedCatalog,
): Promise<void> {
	const zoneUnit = itemAt(catalog.zones, 0);
	const owner = itemAt(profiles, 0);
	const createdAt = latestDate(zoneUnit.createdAt, owner.createdAt);
	await tx
		.update(zone)
		.set({
			boundaryDocument: createZoneBoundaryDocument(["units"], undefined, "a10000000001"),
			themeDocument: createZoneThemeDocument(
				{ accent: "#2563eb", colorScheme: "dark", density: "compact" },
				"a10000000002",
			),
			updatedAt: createdAt,
		})
		.where(eq(zone.id, zoneUnit.id));
	const zoneLocalizations = [
		{
			language: "zh" as const,
			title: "魔法禁書目錄中文維基",
			summary: "《魔法禁書目錄》、《科學超電磁砲》及相關作品的百科專區。",
		},
		{
			language: "en" as const,
			title: "A Certain Magical Index Wiki",
			summary: "An encyclopedia for A Certain Magical Index, Railgun, and related works.",
		},
	];
	for (const [index, localization] of zoneLocalizations.entries())
		await tx
			.insert(unitLocalization)
			.values({
				unitId: zoneUnit.id,
				position: fractionalPositionAt(index),
				avatarType: "image",
				avatarAssetId: OfficialZoneAvatarAsset.id,
				...localization,
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoUpdate({
				target: [unitLocalization.unitId, unitLocalization.language],
				set: {
					position: fractionalPositionAt(index),
					avatarType: "image",
					avatarAssetId: OfficialZoneAvatarAsset.id,
					avatarEmoji: null,
					avatarIconPrefix: null,
					avatarIconName: null,
					title: localization.title,
					summary: localization.summary,
					updatedAt: createdAt,
				},
			});
	await tx.insert(unitSlugAddress).values({
		kind: "canonical",
		scopeUnitId: TopLevelSlugNamespaceUnitIds.zones,
		slug: "toaru",
		targetUnitId: zoneUnit.id,
		createdAt,
		updatedAt: createdAt,
	});

	const labelCopy = [
		["世界", "World"],
		["系列", "Series"],
		["載體", "Media"],
		["編輯規範", "Editing guide"],
		["維基建設", "Wiki projects"],
		["作品觀看順序參考", "Viewing order"],
	] as const;
	const labelUnits = await insertUnits(
		tx,
		labelCopy.map((_, index) =>
			createDescriptor(data, {
				kind: "label",
				seedKey: `toaru-navigation-${position(index)}`,
				ownerProfileId: owner.id,
				localizationKind: "title",
				stateIndex: 8_000 + index,
				forcePublished: true,
				notBefore: [createdAt],
			}),
		),
	);
	await tx.insert(label).values(
		labelUnits.map((label) => ({
			id: label.id,
			createdAt: label.createdAt,
			updatedAt: label.updatedAt,
		})),
	);
	await tx.insert(unitLocalization).values(
		labelUnits.flatMap((label, index) =>
			(["zh", "en"] as const).map((language, languageIndex) => ({
				unitId: label.id,
				language,
				position: fractionalPositionAt(languageIndex),
				title: labelCopy[index]![languageIndex],
				createdAt: label.createdAt,
				updatedAt: label.updatedAt,
			})),
		),
	);
	await tx.insert(unitOwnership).values(
		labelUnits.map((label) => ({
			unitId: label.id,
			profileId: OfficialProfileIds.community,
			assignedByProfileId: OfficialProfileIds.community,
			createdAt: label.createdAt,
			updatedAt: label.updatedAt,
		})),
	);

	const [wikiPost] = await insertUnits(tx, [
		createDescriptor(data, {
			kind: "post",
			seedKey: "toaru-wiki-home",
			ownerProfileId: owner.id,
			localizationKind: "post",
			stateIndex: 8_100,
			forcePublished: true,
			notBefore: [createdAt],
		}),
	]);
	if (!wikiPost) throw new Error("Toaru Wiki Post insertion failed");
	await tx.insert(post).values({
		id: wikiPost.id,
		subjectUnitId: zoneUnit.id,
		kind: "wiki",
		createdAt: wikiPost.createdAt,
		updatedAt: wikiPost.updatedAt,
	});
	await tx.insert(unitLocalization).values(
		(["zh", "en"] as const).map((language, index) => ({
			unitId: wikiPost.id,
			language,
			position: fractionalPositionAt(index),
			title: language === "zh" ? "魔法禁書目錄中文維基" : "A Certain Magical Index Wiki",
			summary: zoneLocalizations[index]!.summary,
			content: toaruWikiBody(language),
			contentStatus: "published" as const,
			createdAt: wikiPost.createdAt,
			updatedAt: wikiPost.updatedAt,
		})),
	);
	await tx.insert(unitOwnership).values({
		unitId: wikiPost.id,
		profileId: owner.id,
		assignedByProfileId: owner.id,
		createdAt: wikiPost.createdAt,
		updatedAt: wikiPost.updatedAt,
	});
	await tx.insert(creditAttribution).values({
		sourceUnitId: wikiPost.id,
		creditedUnitId: owner.id,
		role: "publisher",
		createdAt: wikiPost.createdAt,
		updatedAt: wikiPost.updatedAt,
	});
	await tx.insert(realmUnit).values({
		realmId: OfficialRealmManifest.id,
		unitId: wikiPost.id,
		status: "visible",
		postTargetingLocked: false,
		createdAt: wikiPost.createdAt,
		updatedAt: wikiPost.updatedAt,
	});

	const pageDocument = createUnitReferencedBlockDocument(
		[{ _type: "post-full-view", _key: "a40000000002", postId: wikiPost.id }],
		"a40000000001",
	);
	const [pageUnit] = await insertUnits(tx, [
		createDescriptor(data, {
			kind: "zone_page",
			seedKey: "toaru-zone-home-page",
			ownerProfileId: owner.id,
			localizationKind: "title",
			stateIndex: 8_101,
			forcePublished: true,
			notBefore: [createdAt],
		}),
	]);
	if (!pageUnit) throw new Error("Toaru Zone Page Unit insertion failed");
	await tx.insert(zonePage).values({
		id: pageUnit.id,
		zoneId: zoneUnit.id,
		createdAt: pageUnit.createdAt,
		updatedAt: pageUnit.updatedAt,
	});
	await tx.insert(unitLocalization).values(
		(["zh", "en"] as const).map((language, index) => ({
			unitId: pageUnit.id,
			language,
			position: fractionalPositionAt(index),
			title: language === "zh" ? "魔法禁書目錄中文維基" : "A Certain Magical Index Wiki",
			content: pageDocument,
			contentStatus: "published" as const,
			createdAt: pageUnit.createdAt,
			updatedAt: pageUnit.updatedAt,
		})),
	);
	await tx.insert(unitOwnership).values({
		unitId: pageUnit.id,
		profileId: owner.id,
		assignedByProfileId: owner.id,
		createdAt: pageUnit.createdAt,
		updatedAt: pageUnit.updatedAt,
	});
	await replaceZonePageSlugAddress(tx, {
		zoneId: zoneUnit.id,
		pageUnitId: pageUnit.id,
		slug: ZoneHomePageSlug,
	});
	const pageStructure = await createContentStructure(tx, {
		ownerUnitId: zoneUnit.id,
		kind: "page-structure",
		actorProfileId: owner.id,
	});
	await insertContentStructureNode(tx, {
		ownerUnitId: zoneUnit.id,
		structureId: pageStructure.structure.id,
		baseRevisionId: pageStructure.revisionId,
		actorProfileId: owner.id,
		contentUnitId: pageUnit.id,
		parentId: null,
		position: fractionalPositionAt(0),
	});

	const navigationDocument = {
		_type: "navigation-document" as const,
		_key: "a20000000001",
		items: labelUnits.map((label, index) => {
			const common = {
				_key: `a2${String(index + 2).padStart(10, "0")}`,
				labelUnitId: label.id,
			};
			return [0, 1, 2, 4].includes(index)
				? {
						...common,
						children: [
							{
								_key: `a2${String(index + 20).padStart(10, "0")}`,
								labelUnitId: label.id,
								target: { kind: "unit" as const, unitId: pageUnit.id },
							},
						],
					}
				: { ...common, target: { kind: "unit" as const, unitId: pageUnit.id } };
		}),
	};
	const navigation = await createNavigationStructure(tx, {
		ownerUnitId: zoneUnit.id,
		kind: "zone.navigation",
		document: navigationDocument,
		actorProfileId: owner.id,
	});
	await tx
		.update(unitDock)
		.set({
			document: createDockDocument(
				[
					{
						_type: "menu",
						_key: "a30000000002",
						navigationId: navigation.structure.id,
						orientation: "horizontal",
						appearance: "links",
					},
				],
				"a30000000001",
			),
			updatedAt: createdAt,
		})
		.where(and(eq(unitDock.unitId, zoneUnit.id), eq(unitDock.kind, "main")));
	for (const label of labelUnits)
		await recordUnitRevision(tx, {
			unitId: label.id,
			actorProfileId: OfficialProfileIds.community,
			event: "create",
			message: "Seed Toaru navigation label",
		});
	await recordUnitRevision(tx, {
		unitId: wikiPost.id,
		actorProfileId: owner.id,
		event: "create",
		message: "Seed Toaru Wiki Post",
	});
	await recordUnitRevision(tx, {
		unitId: pageUnit.id,
		actorProfileId: owner.id,
		event: "create",
		message: "Seed Toaru Zone Page Unit",
	});
	await recordUnitRevision(tx, {
		unitId: zoneUnit.id,
		actorProfileId: owner.id,
		event: "update",
		message: "Seed Toaru Zone layout",
	});
}

async function seedContent(
	tx: DatabaseTransaction,
	data: SeedData,
	profiles: readonly CreatedProfile[],
	catalog: SeedCatalog,
): Promise<SeedContent> {
	let stateIndex = 2_000;
	const descriptor = (
		index: number,
		prefix: string,
		localizationKind: LocalizationKind,
		notBefore: readonly Date[] = [],
	) => {
		const owner = itemAt(profiles, index * 7);
		return createDescriptor(data, {
			kind: "post",
			seedKey: index === 0 ? `demo-${prefix}` : `seed-${prefix}-${position(index)}`,
			ownerProfileId: owner.id,
			localizationKind,
			stateIndex: stateIndex++,
			maximumAgeDays: 365,
			forcePublished: index === 0,
			notBefore: [owner.createdAt, ...notBefore],
		});
	};
	const descriptors = (count: number, prefix: string, localizationKind: LocalizationKind) =>
		Array.from({ length: count }, (_, index) => descriptor(index, prefix, localizationKind));

	const rootDescriptors = descriptors(SeedPlan.rootPosts, "post", "post");
	const firstLevelReplyDescriptors = rootDescriptors
		.slice(0, SeedPlan.replies)
		.map((root, index) => {
			const realmUnit = index % 3 === 0 ? itemAt(catalog.realms, index) : null;
			return descriptor(index, "reply", "reply", [
				root.createdAt,
				...(realmUnit ? [realmUnit.createdAt] : []),
			]);
		});
	const nestedReplyDescriptors = Array.from(
		{ length: SeedPlan.replies - firstLevelReplyDescriptors.length },
		(_, index) => {
			const replyIndex = firstLevelReplyDescriptors.length + index;
			const parent = itemAt(firstLevelReplyDescriptors, index * 7);
			return descriptor(replyIndex, "reply", "reply", [parent.createdAt]);
		},
	);

	const rootPosts = await insertUnits(tx, rootDescriptors);
	const createdFirstLevelReplies = await insertUnits(tx, firstLevelReplyDescriptors);
	const createdNestedReplies = await insertUnits(tx, nestedReplyDescriptors);
	const replies = [...createdFirstLevelReplies, ...createdNestedReplies];
	const reviews = await insertUnits(tx, descriptors(SeedPlan.reviews, "review", "post"));
	const chapters = await insertUnits(tx, descriptors(SeedPlan.chapters, "chapter", "post"));
	const chapterLabels = await insertUnits(
		tx,
		descriptors(
			SeedPlan.contentStructureNodes - SeedPlan.chapters,
			"chapter-label",
			"title",
		).map((value): UnitDescriptor => ({ ...value, kind: "label" })),
	);
	const allPosts = [...rootPosts, ...replies, ...reviews, ...chapters];
	await insertUnitDetails(tx, data, [...allPosts, ...chapterLabels]);
	await writeBatches(
		allPosts.map((value) => ({
			sourceUnitId: value.id,
			creditedUnitId: value.ownerProfileId,
			role: "publisher" as const,
		})),
		(batch) => tx.insert(creditAttribution).values(batch),
	);

	await writeBatches(
		rootPosts.map((value, index) => ({
			id: value.id,
			subjectUnitId: index % 4 === 0 ? null : itemAt(catalog.works, index * 11).id,
			kind: "post" as const,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(post).values(batch),
	);
	await writeBatches(
		reviews.map((value, index) => ({
			id: value.id,
			subjectUnitId: itemAt(catalog.works, index * 13).id,
			kind: "review" as const,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(post).values(batch),
	);
	await writeBatches(
		chapters.map((value, index) => ({
			id: value.id,
			subjectUnitId: itemAt(catalog.books, index).id,
			kind: "chapter" as const,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(post).values(batch),
	);
	await writeBatches(
		chapterLabels.map((value) => ({
			id: value.id,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(label).values(batch),
	);
	await writeBatches(
		replies.map((value) => ({
			id: value.id,
			subjectUnitId: null,
			kind: "reply" as const,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt,
		})),
		(batch) => tx.insert(post).values(batch),
	);

	const firstLevelReplies = replies.slice(0, SeedPlan.rootPosts);
	const firstLevelRows = firstLevelReplies.map((value, index) => ({
		postId: value.id,
		rootPostId: itemAt(rootPosts, index).id,
		parentPostId: null,
		depth: 0,
		createdAt: value.createdAt,
	}));
	await writeBatches(firstLevelRows, (batch) => tx.insert(postReply).values(batch));
	await writeBatches(
		replies.slice(SeedPlan.rootPosts).map((value, index) => {
			const parent = itemAt(firstLevelRows, index * 7);
			return {
				postId: value.id,
				rootPostId: parent.rootPostId,
				parentPostId: parent.postId,
				depth: 1,
				createdAt: value.createdAt,
			};
		}),
		(batch) => tx.insert(postReply).values(batch),
	);

	const rootGroups = chapterLabels.slice(0, catalog.books.length);
	const childGroups = chapterLabels.slice(catalog.books.length);
	const structures = await tx
		.insert(contentStructure)
		.values(
			catalog.books.map((bookUnit) => ({
				ownerUnitId: bookUnit.id,
				kind: "book.contents" as const,
				createdAt: bookUnit.createdAt,
				updatedAt: bookUnit.updatedAt,
			})),
		)
		.returning({
			id: contentStructure.id,
			ownerUnitId: contentStructure.ownerUnitId,
		});
	const structureByBook = new Map(
		structures.map((structure) => [structure.ownerUnitId, structure.id]),
	);
	const rootNodeInputs = catalog.books.map((bookUnit, index) => ({
		structureId:
			structureByBook.get(bookUnit.id) ??
			(() => {
				throw new Error(`Missing seed Content Structure for book ${bookUnit.id}`);
			})(),
		ownerUnitId: bookUnit.id,
		parentId: null,
		contentUnitId: itemAt(rootGroups, index).id,
		position: fractionalPositionAt(0),
		contentRating: index % 8 === 0 ? ("r15" as const) : ("general" as const),
		createdAt: bookUnit.createdAt,
		updatedAt: bookUnit.updatedAt,
	}));
	const rootNodes: CreatedNode[] = [];
	for (const batch of chunks(rootNodeInputs)) {
		rootNodes.push(
			...(await tx.insert(contentStructureNode).values(batch).returning({
				id: contentStructureNode.id,
				ownerUnitId: contentStructureNode.ownerUnitId,
				contentUnitId: contentStructureNode.contentUnitId,
				createdAt: contentStructureNode.createdAt,
			})),
		);
	}
	const rootByBook = new Map(rootNodes.map((value) => [value.ownerUnitId, value]));
	const childInputs = Array.from(
		{ length: SeedPlan.contentStructureNodes - rootNodes.length },
		(_, index) => {
			const bookUnit = itemAt(catalog.books, index);
			const parent = rootByBook.get(bookUnit.id);
			if (!parent) throw new Error(`Missing seed root node for book ${bookUnit.id}`);
			return {
				structureId:
					structureByBook.get(bookUnit.id) ??
					(() => {
						throw new Error(`Missing seed Content Structure for book ${bookUnit.id}`);
					})(),
				ownerUnitId: bookUnit.id,
				parentId: parent.id,
				contentUnitId:
					index < chapters.length
						? itemAt(chapters, index).id
						: itemAt(childGroups, index - chapters.length).id,
				position: fractionalPositionAt(1 + Math.floor(index / catalog.books.length)),
				contentRating: index % 11 === 0 ? ("r15" as const) : ("general" as const),
				createdAt: bookUnit.createdAt,
				updatedAt: bookUnit.updatedAt,
			};
		},
	);
	const childNodes: CreatedNode[] = [];
	for (const batch of chunks(childInputs)) {
		childNodes.push(
			...(await tx.insert(contentStructureNode).values(batch).returning({
				id: contentStructureNode.id,
				ownerUnitId: contentStructureNode.ownerUnitId,
				contentUnitId: contentStructureNode.contentUnitId,
				createdAt: contentStructureNode.createdAt,
			})),
		);
	}

	return {
		rootPosts,
		replies,
		reviews,
		chapters,
		allPosts,
		nodes: [...rootNodes, ...childNodes],
	};
}

async function seedStructure(
	tx: DatabaseTransaction,
	data: SeedData,
	profiles: readonly CreatedProfile[],
	catalog: SeedCatalog,
	content: SeedContent,
): Promise<SeedStructure> {
	const collectionTargets = [
		...catalog.works,
		...catalog.series,
		...catalog.tags,
		...catalog.polls,
		...content.rootPosts,
		...content.reviews,
	];
	await writeBatches(
		catalog.collections.flatMap((collectionUnit, collectionIndex) =>
			Array.from(
				{ length: SeedPlan.collectionItems / catalog.collections.length },
				(_, index) => {
					const target = itemAt(collectionTargets, collectionIndex * 23 + index);
					return {
						collectionId: collectionUnit.id,
						unitId: target.id,
						role: index % 5 === 0 ? ("featured" as const) : ("item" as const),
						position: fractionalPositionAt(index),
						addedByProfileId: collectionUnit.ownerProfileId,
						createdAt: collectionUnit.createdAt,
						updatedAt: collectionUnit.updatedAt,
					};
				},
			),
		),
		(batch) => tx.insert(collectionItem).values(batch),
	);

	const editableUnits = [...catalog.works, ...catalog.series, ...content.rootPosts];
	await writeBatches(
		Array.from({ length: 150 }, (_, index) => {
			const target = itemAt(editableUnits, index);
			const editor = itemAt(
				profiles.filter((value) => value.id !== target.ownerProfileId),
				index * 7,
			);
			return {
				unitId: target.id,
				subjectKind: "profile" as const,
				profileId: editor.id,
				permission: "unit.update" as const,
				scope: [],
				grantedByProfileId: target.ownerProfileId,
				createdAt: target.createdAt,
				updatedAt: target.updatedAt,
			};
		}),
		(batch) => tx.insert(unitAccessGrant).values(batch),
	);

	const memberRows = catalog.realms.flatMap((realmUnit, realmIndex) => {
		const otherProfiles = profiles.filter((value) => value.id !== realmUnit.ownerProfileId);
		return Array.from({ length: SeedPlan.realmMembers / catalog.realms.length }, (_, index) => {
			const member =
				index === 0
					? profiles.find((value) => value.id === realmUnit.ownerProfileId)
					: itemAt(otherProfiles, realmIndex * 7 + index - 1);
			if (!member) throw new Error(`Missing owner profile for Realm ${realmUnit.id}`);
			const joinedAt = latestDate(realmUnit.createdAt, member.createdAt);
			return {
				realmId: realmUnit.id,
				profileId: member.id,
				state: itemAt(["active", "active", "active", "pending", "muted"] as const, index),
				joinedAt,
				updatedAt: joinedAt,
			};
		});
	});
	await writeBatches(memberRows, (batch) => tx.insert(realmMember).values(batch));
	await writeBatches(
		catalog.realms.flatMap((realmUnit, realmIndex) =>
			Array.from(
				{ length: SeedPlan.realmUnitFollows / catalog.realms.length },
				(_, index) => ({
					followerProfileId: itemAt(profiles, realmIndex * 5 + index).id,
					unitId: realmUnit.id,
					createdAt: realmUnit.createdAt,
				}),
			),
		),
		(batch) => tx.insert(unitFollow).values(batch),
	);

	const revisions: (typeof realmRuleRevision.$inferSelect)[] = [];
	for (const batch of chunks(
		catalog.realms.map((realmUnit, index) => ({
			realmId: realmUnit.id,
			version: 1,
			acknowledgementMode:
				index % 2 === 0 ? ("explicit" as const) : ("implicit_on_follow" as const),
			requireOnJoin: index % 2 === 0,
			requireOnPost: index % 3 === 0,
			createdByProfileId: realmUnit.ownerProfileId,
			publishedAt: realmUnit.createdAt,
		})),
	)) {
		revisions.push(...(await tx.insert(realmRuleRevision).values(batch).returning()));
	}
	const ruleDescriptors = revisions.flatMap((revision, revisionIndex) => {
		const ownerProfileId = revision.createdByProfileId;
		if (!ownerProfileId) throw new Error("Seed Realm rule revision has no creator");
		return Array.from({ length: SeedPlan.realmRules / revisions.length }, (_, index) => ({
			revision,
			position: index,
			descriptor: {
				...createDescriptor(data, {
					kind: "realm_rule",
					seedKey: `seed-realm-rule-${position(revisionIndex)}-${position(index)}`,
					ownerProfileId,
					localizationKind: "post",
					stateIndex: revisionIndex * 100 + index,
					forcePublished: true,
					notBefore: [revision.publishedAt],
				}),
			},
		}));
	});
	const ruleUnits = await insertUnits(
		tx,
		ruleDescriptors.map(({ descriptor }) => descriptor),
	);
	await insertUnitDetails(tx, data, ruleUnits);
	await writeBatches(
		ruleUnits.map((ruleUnit, index) => {
			const input = itemAt(ruleDescriptors, index);
			return {
				id: ruleUnit.id,
				revisionId: input.revision.id,
				position: input.position,
				createdAt: input.revision.publishedAt,
			};
		}),
		(batch) => tx.insert(realmRule).values(batch),
	);
	await writeBatches(
		revisions.flatMap((revision, revisionIndex) =>
			Array.from(
				{ length: SeedPlan.realmRuleAcceptances / revisions.length },
				(_, index) => ({
					revisionId: revision.id,
					profileId: itemAt(profiles, revisionIndex * 7 + index).id,
					language: itemAt(data.languages(revisionIndex + index), 0),
					acceptedAt: revision.publishedAt,
				}),
			),
		),
		(batch) => tx.insert(realmRuleAcceptance).values(batch),
	);
	const realmTargets = [
		...catalog.works,
		...catalog.series,
		...catalog.tags,
		...catalog.polls,
		...content.rootPosts,
		...content.reviews,
	];
	await writeBatches(
		catalog.realms.flatMap((realmUnit, realmIndex) =>
			Array.from({ length: SeedPlan.realmPins / catalog.realms.length }, (_, index) => ({
				realmId: realmUnit.id,
				unitId: itemAt(realmTargets, realmIndex * 37 + index).id,
				kind: index % 3 === 0 ? ("highlight" as const) : ("pinned" as const),
				position: fractionalPositionAt(index),
				createdByProfileId: realmUnit.ownerProfileId,
				createdAt: realmUnit.createdAt,
				updatedAt: realmUnit.updatedAt,
			})),
		),
		(batch) => tx.insert(realmPin).values(batch),
	);
	const realmUnitRows = catalog.realms.flatMap((realmUnit, realmIndex) =>
		Array.from({ length: SeedPlan.realmUnits / catalog.realms.length }, (_, index) => {
			const target = itemAt(realmTargets, realmIndex * 53 + index);
			const createdAt = latestDate(realmUnit.createdAt, target.createdAt);
			return {
				realmId: realmUnit.id,
				unitId: target.id,
				postTargetingLocked: index % 19 === 0,
				status: itemAt(
					["visible", "visible", "visible", "visible", "pending"] as const,
					index,
				),
				createdAt,
				updatedAt: createdAt,
			};
		}),
	);
	await writeBatches(
		realmUnitRows.map((row) => ({ ...row, postTargetingLocked: false })),
		(batch) => tx.insert(realmUnit).values(batch),
	);
	for (const row of realmUnitRows.filter((candidate) => candidate.postTargetingLocked))
		await tx
			.update(realmUnit)
			.set({ postTargetingLocked: true })
			.where(and(eq(realmUnit.realmId, row.realmId), eq(realmUnit.unitId, row.unitId)));

	await writeBatches(
		Array.from({ length: SeedPlan.capabilityGrants }, (_, index) => {
			const createdAt = data.pastDate(365);
			const revoked = index % 13 === 0;
			return {
				profileId: itemAt(profiles, index * 7).id,
				capability: itemAt(PlatformCapabilityValues, index),
				grantedByProfileId: itemAt(profiles, index * 11 + 1).id,
				expiresAt: index % 5 === 0 ? data.futureDate(365) : null,
				revokedAt: revoked ? new Date(createdAt.getTime() + 86_400_000) : null,
				revokedByProfileId: revoked ? itemAt(profiles, index * 13 + 2).id : null,
				createdAt,
				updatedAt: createdAt,
			};
		}),
		(batch) => tx.insert(platformCapabilityGrant).values(batch),
	);
	const platformAdministrator = itemAt(profiles, 0);
	await tx.insert(platformCapabilityGrant).values(
		(
			[
				"platform.api_token_policy.manage",
				"platform.access.manage",
				"platform.audit.read",
				"unit.slug.manage",
				"unit.slug.namespace.manage",
				"unit.slug.redirect.release",
			] as const
		).map((capability) => ({
			profileId: platformAdministrator.id,
			capability,
			grantedByProfileId: platformAdministrator.id,
		})),
	);
	await writeBatches(
		catalog.zones.flatMap((zoneUnit, zoneIndex) =>
			Array.from({ length: SeedPlan.zoneUnitFollows / catalog.zones.length }, (_, index) => ({
				unitId: zoneUnit.id,
				followerProfileId: itemAt(profiles, zoneIndex * 7 + index).id,
				createdAt: zoneUnit.createdAt,
			})),
		),
		(batch) => tx.insert(unitFollow).values(batch),
	);

	return { realmMembers: memberRows, realmUnits: realmUnitRows };
}

async function seedInteractions(
	tx: DatabaseTransaction,
	data: SeedData,
	profiles: readonly CreatedProfile[],
	catalog: SeedCatalog,
	content: SeedContent,
): Promise<void> {
	await writeBatches(
		profiles.flatMap((follower, followerIndex) => {
			const candidates = profiles.filter((value) => value.id !== follower.id);
			return Array.from(
				{ length: SeedPlan.profileUnitFollows / profiles.length },
				(_, index) => {
					const followed = itemAt(candidates, followerIndex * 7 + index);
					return {
						followerProfileId: follower.id,
						unitId: followed.id,
						createdAt: latestDate(
							data.pastDate(365),
							follower.createdAt,
							followed.createdAt,
						),
					};
				},
			);
		}),
		(batch) => tx.insert(unitFollow).values(batch),
	);
	await writeBatches(
		profiles.map((blocker, index) => {
			const blocked = itemAt(
				profiles.filter((value) => value.id !== blocker.id),
				index * 13,
			);
			return {
				blockerProfileId: blocker.id,
				blockedProfileId: blocked.id,
				createdAt: latestDate(data.pastDate(180), blocker.createdAt, blocked.createdAt),
			};
		}),
		(batch) => tx.insert(profileBlock).values(batch),
	);

	const firstNodeByBook = new Map<string, CreatedNode>();
	for (const node of content.nodes) {
		if (!firstNodeByBook.has(node.ownerUnitId)) firstNodeByBook.set(node.ownerUnitId, node);
	}
	await writeBatches(
		profiles.flatMap((seedProfile, profileIndex) =>
			Array.from({ length: SeedPlan.unitProgress / profiles.length }, (_, index) => {
				const target = itemAt(catalog.works, profileIndex * 17 + index);
				const createdAt = latestDate(
					data.pastDate(365),
					seedProfile.createdAt,
					target.createdAt,
				);
				const lastSeenAt = new Date(createdAt.getTime() + (index + 1) * 60_000);
				const progress = (index % 11) / 10;
				return {
					profileId: seedProfile.id,
					unitId: target.id,
					progress,
					status: itemAt(
						["backlog", "active", "active", "paused", "completed", "dropped"] as const,
						index,
					),
					completedCount: progress === 1 ? 1 : 0,
					totalTimeMs: BigInt((index + 1) * 900_000),
					firstSeenAt: createdAt,
					lastSeenAt,
					lastContentStructureNodeId:
						target.kind === "book"
							? (firstNodeByBook.get(target.id)?.id ?? null)
							: null,
					createdAt,
					updatedAt: lastSeenAt,
				};
			}),
		),
		(batch) => tx.insert(unitProgress).values(batch),
	);
	await writeBatches(
		profiles.flatMap((seedProfile, profileIndex) =>
			Array.from(
				{ length: SeedPlan.contentStructureNodeProgress / profiles.length },
				(_, index) => {
					const node = itemAt(content.nodes, profileIndex * 13 + index);
					return {
						profileId: seedProfile.id,
						nodeId: node.id,
						completedAt: latestDate(
							data.pastDate(180),
							seedProfile.createdAt,
							node.createdAt,
						),
					};
				},
			),
		),
		(batch) => tx.insert(contentStructureNodeProgress).values(batch),
	);

	const interactionTargets = [
		...catalog.works,
		...catalog.series,
		...catalog.tags,
		...catalog.polls,
		...content.rootPosts,
		...content.reviews,
	];
	await writeBatches(
		profiles.flatMap((seedProfile, profileIndex) =>
			Array.from({ length: SeedPlan.unitReactions / profiles.length }, (_, index) => {
				const target = itemAt(interactionTargets, profileIndex * 67 + index);
				const realmUnit =
					index % 3 === 0 ? itemAt(catalog.realms, profileIndex + index) : null;
				const createdAt = latestDate(
					data.pastDate(365),
					seedProfile.createdAt,
					target.createdAt,
					...(realmUnit ? [realmUnit.createdAt] : []),
				);
				return {
					profileId: seedProfile.id,
					unitId: target.id,
					realmId: realmUnit?.id ?? null,
					reaction: index % 7 === 0 ? ("downvote" as const) : ("upvote" as const),
					createdAt,
					updatedAt: createdAt,
				};
			}),
		),
		(batch) => tx.insert(unitReaction).values(batch),
	);
	await writeBatches(
		profiles.flatMap((seedProfile, profileIndex) =>
			Array.from({ length: SeedPlan.unitShares / profiles.length }, (_, index) => {
				const target = itemAt(interactionTargets, profileIndex * 23 + index);
				return {
					profileId: seedProfile.id,
					unitId: target.id,
					createdAt: latestDate(
						data.pastDate(365),
						seedProfile.createdAt,
						target.createdAt,
					),
				};
			}),
		),
		(batch) => tx.insert(unitShare).values(batch),
	);
	await writeBatches(
		profiles.flatMap((seedProfile, profileIndex) =>
			Array.from({ length: SeedPlan.scores / profiles.length }, (_, index) => {
				const target = itemAt(interactionTargets, profileIndex * 31 + index);
				const realmUnit = itemAt(catalog.realms, profileIndex + index);
				const createdAt = latestDate(
					data.pastDate(365),
					seedProfile.createdAt,
					target.createdAt,
					realmUnit.createdAt,
				);
				return {
					profileId: seedProfile.id,
					unitId: target.id,
					contextUnitId: realmUnit.id,
					value: 1 + ((profileIndex + index * 3) % 10),
					createdAt,
					updatedAt: createdAt,
				};
			}),
		),
		(batch) => tx.insert(score).values(batch),
	);

	const options = await tx
		.select({ id: pollOption.id, pollId: pollOption.pollId, createdAt: pollOption.createdAt })
		.from(pollOption);
	const optionsByPoll = new Map<string, { id: string; pollId: string; createdAt: Date }[]>();
	for (const option of options) {
		const values = optionsByPoll.get(option.pollId) ?? [];
		values.push(option);
		optionsByPoll.set(option.pollId, values);
	}
	await writeBatches(
		profiles.flatMap((seedProfile, profileIndex) =>
			Array.from({ length: SeedPlan.pollVotes / profiles.length }, (_, index) => {
				const pollUnit = itemAt(catalog.polls, profileIndex * 7 + index);
				const option = itemAt(optionsByPoll.get(pollUnit.id) ?? [], profileIndex + index);
				const realmUnit =
					index % 2 === 0 ? itemAt(catalog.realms, profileIndex + index) : null;
				return {
					pollId: pollUnit.id,
					profileId: seedProfile.id,
					optionId: option.id,
					realmId: realmUnit?.id ?? null,
					createdAt: latestDate(
						data.pastDate(180),
						seedProfile.createdAt,
						pollUnit.createdAt,
						option.createdAt,
						...(realmUnit ? [realmUnit.createdAt] : []),
					),
				};
			}),
		),
		(batch) => tx.insert(pollVote).values(batch),
	);
}

async function seedCommunications(
	tx: DatabaseTransaction,
	data: SeedData,
	profiles: readonly CreatedProfile[],
	content: SeedContent,
): Promise<void> {
	const conversationInputs = Array.from({ length: SeedPlan.conversations }, (_, index) => {
		const first = itemAt(profiles, Math.floor(index / 10));
		const second = itemAt(profiles, 10 + (index % 10));
		const [low, high] = first.id < second.id ? [first, second] : [second, first];
		return {
			participantLowProfileId: low.id,
			participantHighProfileId: high.id,
			createdAt: data.pastDate(120, 1),
		};
	});
	const conversations: CreatedConversation[] = [];
	for (const batch of chunks(conversationInputs)) {
		conversations.push(
			...(await tx.insert(conversation).values(batch).returning({
				id: conversation.id,
				lowId: conversation.participantLowProfileId,
				highId: conversation.participantHighProfileId,
			})),
		);
	}
	const conversationCreatedAt = new Map(
		conversationInputs.map((value) => [
			`${value.participantLowProfileId}:${value.participantHighProfileId}`,
			value.createdAt,
		]),
	);
	const messageInputs = conversations.flatMap((value, conversationIndex) => {
		const startedAt = conversationCreatedAt.get(`${value.lowId}:${value.highId}`);
		if (!startedAt) throw new Error(`Missing seed Conversation timestamp for ${value.id}`);
		return Array.from({ length: SeedPlan.messages / conversations.length }, (_, index) => {
			const createdAt = new Date(startedAt.getTime() + (index + 1) * 60_000);
			const deleted = (conversationIndex * 10 + index) % 31 === 0;
			return {
				conversationId: value.id,
				senderProfileId: index % 2 === 0 ? value.lowId : value.highId,
				content: deleted
					? null
					: data.fakerByLanguage.en.lorem.sentences({ min: 1, max: 2 }),
				deletedAt: deleted ? new Date(createdAt.getTime() + 60_000) : null,
				createdAt,
				updatedAt: createdAt,
			};
		});
	});
	const messages: (typeof message.$inferSelect)[] = [];
	for (const batch of chunks(messageInputs)) {
		messages.push(...(await tx.insert(message).values(batch).returning()));
	}
	const messagesByConversation = new Map<string, (typeof message.$inferSelect)[]>();
	for (const value of messages) {
		const values = messagesByConversation.get(value.conversationId) ?? [];
		values.push(value);
		messagesByConversation.set(value.conversationId, values);
	}
	await writeBatches(
		conversations.flatMap((value) => {
			const conversationMessages = messagesByConversation.get(value.id) ?? [];
			const lastMessage = itemAt(conversationMessages, conversationMessages.length - 1);
			return [value.lowId, value.highId].map((profileId, index) => ({
				conversationId: value.id,
				profileId,
				lastReadMessageId:
					index === 0 ? lastMessage.id : itemAt(conversationMessages, 4).id,
				readAt: lastMessage.createdAt,
				createdAt: conversationMessages[0]?.createdAt ?? lastMessage.createdAt,
				updatedAt: lastMessage.createdAt,
			}));
		}),
		(batch) => tx.insert(conversationRead).values(batch),
	);

	const notificationKinds = [
		"reply",
		"new_follower",
		"direct_message",
		"moderation",
		"realm",
		"system",
	] as const;
	await writeBatches(
		profiles.flatMap((seedProfile, profileIndex) =>
			notificationKinds.map((kind, index) => {
				const createdAt = data.pastDate(365);
				return {
					profileId: seedProfile.id,
					kind,
					inApp: (profileIndex + index) % 7 !== 0,
					email: (profileIndex + index) % 3 !== 0,
					createdAt,
					updatedAt: createdAt,
				};
			}),
		),
		(batch) => tx.insert(notificationPreference).values(batch),
	);
	const notificationSubjects = [...content.rootPosts, ...content.reviews, ...content.replies];
	const seededNotificationKinds = ["reply", "new_follower", "direct_message"] as const;
	await writeBatches(
		profiles.flatMap((recipient, profileIndex) =>
			Array.from({ length: SeedPlan.notifications / profiles.length }, (_, index) => {
				const createdAt = data.pastDate(180);
				const actor = itemAt(
					profiles.filter((value) => value.id !== recipient.id),
					profileIndex * 7 + index,
				);
				const emailStatus = itemAt(
					["not_requested", "pending", "sent", "failed"] as const,
					profileIndex + index,
				);
				const kind = itemAt(seededNotificationKinds, profileIndex + index);
				const conversationId = itemAt(conversations, profileIndex * 7 + index).id;
				return {
					recipientProfileId: recipient.id,
					actorProfileId: actor.id,
					kind,
					subjectUnitId:
						kind === "reply"
							? itemAt(notificationSubjects, profileIndex * 13 + index).id
							: kind === "new_follower"
								? actor.id
								: null,
					payload:
						kind === "direct_message"
							? { type: "direct_message", conversationId }
							: null,
					dedupeKey: `seed:${profileIndex}:${index}`,
					inAppVisible: index % 9 !== 0,
					readAt: index % 3 === 0 ? new Date(createdAt.getTime() + 60_000) : null,
					emailStatus,
					emailedAt:
						emailStatus === "sent" ? new Date(createdAt.getTime() + 120_000) : null,
					emailError: emailStatus === "failed" ? "Seeded delivery failure" : null,
					createdAt,
					updatedAt: createdAt,
				};
			}),
		),
		(batch) => tx.insert(notification).values(batch),
	);
}

async function seedGovernance(
	tx: DatabaseTransaction,
	data: SeedData,
	profiles: readonly CreatedProfile[],
	catalog: SeedCatalog,
	content: SeedContent,
	structure: SeedStructure,
): Promise<void> {
	const governanceTargets = [
		...catalog.works,
		...catalog.series,
		...catalog.polls,
		...content.rootPosts,
		...content.reviews,
	];
	const feedbackRows: (typeof feedback.$inferSelect)[] = [];
	for (let index = 0; index < SeedPlan.feedback; index += 1) {
		const createdAt = data.pastDate(365, 1);
		const resolved = index % 3 === 0;
		const reporter = itemAt(profiles, index * 7);
		const resolver = resolved ? itemAt(profiles, index * 13 + 1) : undefined;
		const subjectUnitId = itemAt(governanceTargets, index * 11).id;
		const [row] = await tx
			.insert(feedback)
			.values({
				profileId: reporter.id,
				kind: itemAt(["report", "bug", "feature", "other"] as const, index),
				url: index % 4 === 0 ? `https://example.test/feedback/${position(index)}` : null,
				subjectUnitId,
				resolutionCode: resolved ? "administrative" : null,
				resolvedByProfileId: resolver?.id ?? null,
				resolvedAt: resolved ? new Date(createdAt.getTime() + 3_600_000) : null,
				createdAt,
				updatedAt: createdAt,
			})
			.returning();
		if (!row) throw new Error("Seed feedback insertion did not return a row");
		feedbackRows.push(row);
		await createGovernanceNotePost(tx, {
			actorProfileId: reporter.id,
			subjectKind: "feedback",
			subjectId: row.id,
			subjectUnitId,
			note: {
				role: "evidence",
				language: "en",
				content: createPortableTextDocument(data.portableText("en", 2)),
			},
		});
		if (resolver)
			await createGovernanceNotePost(tx, {
				actorProfileId: resolver.id,
				subjectKind: "feedback",
				subjectId: row.id,
				subjectUnitId,
				publicRecipientProfileIds: [reporter.id],
				note: {
					role: "public_notice",
					language: "en",
					content: createPortableTextDocument(data.portableText("en", 1)),
				},
			});
	}

	const targetKinds = [
		"unit",
		"unit_field",
		"profile",
		"realm_unit",
		"realm_member",
		"feedback",
	] as const;
	const normalCases: (typeof moderationCase.$inferSelect)[] = [];
	for (const batch of chunks(
		Array.from({ length: SeedPlan.moderationCases - 10 }, (_, index) => {
			const targetKind = itemAt(targetKinds, index);
			const realmTarget =
				targetKind === "realm_member" || targetKind === "realm_unit"
					? selectSeedRealmModerationTarget(targetKind, index, {
							members: structure.realmMembers,
							units: structure.realmUnits,
						})
					: null;
			const targetId = realmTarget
				? realmTarget.targetId
				: targetKind === "profile"
					? itemAt(profiles, index * 7).id
					: targetKind === "feedback"
						? itemAt(feedbackRows, index * 11).id
						: itemAt(governanceTargets, index * 13).id;
			const createdAt = data.pastDate(180);
			return {
				state: itemAt(
					[
						"new",
						"triaged",
						"assigned",
						"actioned",
						"resolved",
						"rejected",
						"escalated",
					] as const,
					index,
				),
				authority: realmTarget?.authority ?? ("platform" as const),
				realmId: realmTarget?.realmId ?? null,
				targetKind,
				targetId,
				targetPath: targetKind === "unit_field" ? "/localizations/en/title" : null,
				reporterProfileId: itemAt(profiles, index * 17).id,
				assignedProfileId: index % 4 === 0 ? null : itemAt(profiles, index * 19 + 1).id,
				createdAt,
				updatedAt: createdAt,
			};
		}),
	)) {
		normalCases.push(...(await tx.insert(moderationCase).values(batch).returning()));
	}
	const duplicateCases = await tx
		.insert(moderationCase)
		.values(
			Array.from({ length: 10 }, (_, index) => {
				const original = itemAt(normalCases, index * 3);
				return {
					state: "duplicate" as const,
					authority: original.authority,
					realmId: original.realmId,
					targetKind: original.targetKind,
					targetId: original.targetId,
					targetPath: original.targetPath,
					reporterProfileId: itemAt(profiles, index * 7 + 2).id,
					assignedProfileId: original.assignedProfileId,
					duplicateOfCaseId: original.id,
					createdAt: data.pastDate(90),
					updatedAt: data.pastDate(30),
				};
			}),
		)
		.returning();
	const cases = [...normalCases, ...duplicateCases];

	const actionKinds = [
		"approve",
		"remove",
		"restore",
		"lock_post_targeting",
		"unlock_post_targeting",
		"warning",
		"silence",
		"suspension",
		"ban",
		"rate_limit",
		"trust_restriction",
		"note",
	] as const;
	const normalActions: (typeof moderationAction.$inferSelect)[] = [];
	for (const batch of chunks(
		Array.from(
			{ length: SeedPlan.moderationActions - SeedPlan.accountEnforcements - 10 },
			(_, index) => {
				const caseRow = itemAt(cases, index);
				const actor = itemAt(profiles, index * 7 + 1);
				const kind = itemAt(actionKinds, index);
				return {
					caseId: caseRow.id,
					actorProfileId: actor.id,
					kind,
					resultingStatus: kind === "remove" ? ("removed" as const) : null,
					previousPostTargetingLocked:
						kind === "lock_post_targeting"
							? false
							: kind === "unlock_post_targeting"
								? true
								: null,
					resultingPostTargetingLocked:
						kind === "lock_post_targeting"
							? true
							: kind === "unlock_post_targeting"
								? false
								: null,
					reasonCode: "administrative" as const,
					requestId: `seed-request-${position(index)}`,
					idempotencyKey: `seed-action-${position(index)}`,
					createdAt: latestDate(data.pastDate(120), caseRow.createdAt, actor.createdAt),
				};
			},
		),
	)) {
		normalActions.push(...(await tx.insert(moderationAction).values(batch).returning()));
	}
	const reverseActions = await tx
		.insert(moderationAction)
		.values(
			Array.from({ length: 10 }, (_, index) => {
				const reversed = itemAt(normalActions, index);
				const actor = itemAt(profiles, index * 11 + 2);
				return {
					caseId: reversed.caseId,
					actorProfileId: actor.id,
					kind: "reverse" as const,
					reasonCode: "administrative" as const,
					reversesActionId: reversed.id,
					requestId: `seed-reverse-request-${position(index)}`,
					idempotencyKey: `seed-reverse-${position(index)}`,
					createdAt: latestDate(data.pastDate(30), reversed.createdAt, actor.createdAt),
				};
			}),
		)
		.returning();
	const profileById = new Map(profiles.map((value) => [value.id, value]));
	const profileCases = cases.filter(
		(value) => value.targetKind === "profile" && value.authority === "platform",
	);
	const enforcementPlans = Array.from({ length: SeedPlan.accountEnforcements }, (_, index) => {
		const caseRow = itemAt(profileCases, index);
		const targetProfile = profileById.get(caseRow.targetId);
		if (!targetProfile) {
			throw new Error(`Missing seed enforcement target Profile ${caseRow.targetId}`);
		}
		const actor = itemAt(profiles, index * 7 + 1);
		const startsAt = latestDate(
			data.pastDate(90),
			caseRow.createdAt,
			targetProfile.createdAt,
			actor.createdAt,
		);
		return createSeedEnforcementPlan({
			index,
			profileId: targetProfile.id,
			caseId: caseRow.id,
			actorProfileId: actor.id,
			kind: itemAt(EnforcementKindValues, index),
			startsAt,
			expiresAt: index % 4 === 0 ? null : new Date(startsAt.getTime() + 30 * 86_400_000),
		});
	});
	const enforcementActions: (typeof moderationAction.$inferSelect)[] = [];
	for (const batch of chunks(enforcementPlans.map((value) => value.action))) {
		enforcementActions.push(...(await tx.insert(moderationAction).values(batch).returning()));
	}
	const enforcementActionIdByKey = new Map<string, string>();
	for (const action of enforcementActions) {
		if (action.idempotencyKey) enforcementActionIdByKey.set(action.idempotencyKey, action.id);
	}
	await writeBatches(
		enforcementPlans.map((plan) => {
			const decisionActionId = enforcementActionIdByKey.get(plan.action.idempotencyKey);
			if (!decisionActionId) {
				throw new Error(`Missing seed enforcement decision ${plan.action.idempotencyKey}`);
			}
			return { ...plan.enforcement, decisionActionId };
		}),
		(batch) => tx.insert(accountEnforcement).values(batch),
	);
	const actions = [...normalActions, ...reverseActions, ...enforcementActions];
	await writeBatches(
		Array.from({ length: SeedPlan.auditEvents }, (_, index) => ({
			schemaVersion: 2,
			category: index % 13 === 0 ? ("policy_denied" as const) : ("admin_activity" as const),
			outcome: index % 13 === 0 ? ("denied" as const) : ("succeeded" as const),
			actorKind: index % 10 === 0 ? ("system" as const) : ("profile" as const),
			actorProfileId: index % 10 === 0 ? null : itemAt(profiles, index * 7).id,
			actorCredentialKind: index % 10 === 0 ? ("system" as const) : ("session" as const),
			authorityKind: "unit" as const,
			authorityId: itemAt(governanceTargets, index * 17).id,
			action: itemAt(
				["unit.update", "moderation.decide", "realm.manage", "profile.login"],
				index,
			),
			reasonCode: index % 13 === 0 ? "policy_denied" : null,
			requestId: `seed-audit-${position(index)}`,
			targetKind: "unit",
			targetId: itemAt(governanceTargets, index * 17).id,
			targetPath: index % 5 === 0 ? "/localizations/en/title" : null,
			details: { seed: true, actionId: itemAt(actions, index).id },
			createdAt: data.pastDate(180),
		})),
		(batch) => tx.insert(auditEvent).values(batch),
	);
}

async function seedRecommendations(
	tx: DatabaseTransaction,
	data: SeedData,
	profiles: readonly CreatedProfile[],
	catalog: SeedCatalog,
	content: SeedContent,
): Promise<void> {
	const targets = [
		...catalog.works,
		...catalog.series,
		...catalog.tags,
		...catalog.polls,
		...content.rootPosts,
		...content.reviews,
	];
	const surfaces = [
		"home_feed",
		"home_book",
		"home_software",
		"home_media",
		"unit_related",
		"post_related",
	] as const;
	const eventTypes = ["impression", "open", "dwell_30s", "not_interested"] as const;
	await writeBatches(
		Array.from({ length: SeedPlan.recommendationEvents }, (_, index) => {
			const seedProfile = index % 20 === 0 ? null : itemAt(profiles, index * 7);
			const target = itemAt(targets, index * 11);
			const occurredAt = latestDate(
				data.pastDate(90),
				target.createdAt,
				...(seedProfile ? [seedProfile.createdAt] : []),
			);
			return {
				profileId: seedProfile?.id ?? null,
				requestId: data.fakerByLanguage.en.string.uuid(),
				surface: itemAt(surfaces, index),
				type: itemAt(eventTypes, index * 3),
				targetUnitId: target.id,
				position: index % 100,
				policyVersion: RecommendationPolicyVersion,
				occurredAt,
				createdAt: occurredAt,
			};
		}),
		(batch) => tx.insert(recommendationEvent).values(batch),
	);
	await writeBatches(
		profiles.flatMap((seedProfile, profileIndex) =>
			Array.from(
				{ length: SeedPlan.recommendationExclusions / profiles.length },
				(_, index) => {
					const target = itemAt(targets, profileIndex * 17 + index);
					return {
						profileId: seedProfile.id,
						unitId: target.id,
						createdAt: latestDate(
							data.pastDate(180),
							seedProfile.createdAt,
							target.createdAt,
						),
					};
				},
			),
		),
		(batch) => tx.insert(recommendationExclusion).values(batch),
	);
}

/**
 * Covers cross-cutting contracts whose behavior is otherwise invisible in a
 * large catalog-shaped fixture. Each row is intentionally minimal and points
 * at the richer scenarios created above.
 */
async function seedCoverageContracts(
	tx: DatabaseTransaction,
	data: SeedData,
	profiles: readonly CreatedProfile[],
	catalog: SeedCatalog,
	content: SeedContent,
): Promise<void> {
	const actor = itemAt(profiles, 0);
	const collaborator = itemAt(
		profiles.filter((value) => value.id !== actor.id),
		0,
	);
	const target = itemAt(catalog.works, 0);
	const targetEntity = itemAt(catalog.entities, 0);
	const targetTag = itemAt(catalog.tags, 0);
	const secondTag = itemAt(catalog.tags, 1);
	const targetRealm = itemAt(catalog.realms, 0);
	const contextPost = itemAt(content.rootPosts, 0);
	const [associationContextPost] = await tx
		.select({ id: post.id, createdAt: post.createdAt })
		.from(post)
		.where(eq(post.kind, "wiki"))
		.limit(1);
	if (!associationContextPost)
		throw new Error("Coverage scenario requires a wiki association context Post");
	const createdAt = latestDate(
		data.pastDate(30),
		actor.createdAt,
		collaborator.createdAt,
		target.createdAt,
		targetEntity.createdAt,
		targetTag.createdAt,
		secondTag.createdAt,
		targetRealm.createdAt,
		contextPost.createdAt,
		associationContextPost.createdAt,
	);
	const expiresAt = new Date(data.referenceTime.getTime() + 30 * 86_400_000);

	await createSharedSearchQuery(tx, {
		createdByProfileId: actor.id,
		document: {
			version: 1,
			template: "global",
			state: {},
			selections: [],
		},
	});

	const [demoToken] = await tx
		.select({ id: apikeys.id })
		.from(apikeys)
		.where(eq(apikeys.referenceId, actor.authUserId))
		.limit(1);
	if (!demoToken) throw new Error("Coverage scenario requires the demo API token");
	await bindStandardPolicyToToken(tx, {
		tokenId: demoToken.id,
		actorProfileId: actor.id,
		override: {
			limits: { requestsPerMinute: 120 },
			operations: { getApiUnits: { requestsPerMinute: 90 } },
		},
	});

	await tx.insert(subjectAssociation).values({
		unitId: target.id,
		entityId: targetEntity.id,
		contextPostId: associationContextPost.id,
		role: "about",
		position: fractionalPositionAt(0),
		createdAt,
		updatedAt: createdAt,
	});
	await tx.insert(unitAssociationProposal).values({
		sourceUnitId: itemAt(catalog.works, 1).id,
		targetUnitId: targetEntity.id,
		kind: "subject",
		role: "related_subject",
		direction: "request",
		createdByProfileId: actor.id,
		expiresAt,
		createdAt,
		updatedAt: createdAt,
	});

	await tx.insert(unitAccessInvitation).values({
		unitId: target.id,
		invitedProfileId: collaborator.id,
		permissions: ["unit.read", "unit.update"],
		scope: ["localizations"],
		invitedByProfileId: target.ownerProfileId,
		expiresAt,
		createdAt,
		updatedAt: createdAt,
	});
	await tx.insert(unitAccessRestriction).values({
		unitId: itemAt(catalog.works, 2).id,
		subjectKind: "profile",
		profileId: collaborator.id,
		permission: "unit.update",
		scope: [],
		reasonCode: "administrative",
		createdByProfileId: actor.id,
		expiresAt,
		createdAt,
		updatedAt: createdAt,
	});

	await tx.insert(profileRealmTagSubscription).values({
		profileId: actor.id,
		realmId: targetRealm.id,
		position: fractionalPositionAt(0),
		createdAt,
		updatedAt: createdAt,
	});
	await tx.insert(profileUnitTag).values({
		profileId: actor.id,
		unitId: target.id,
		tagId: targetTag.id,
		position: fractionalPositionAt(0),
		createdAt,
		updatedAt: createdAt,
	});
	await tx
		.insert(realmUnit)
		.values([
			{
				realmId: targetRealm.id,
				unitId: target.id,
				status: "visible",
				createdAt,
				updatedAt: createdAt,
			},
			{
				realmId: targetRealm.id,
				unitId: contextPost.id,
				status: "visible",
				createdAt,
				updatedAt: createdAt,
			},
		])
		.onConflictDoUpdate({
			target: [realmUnit.realmId, realmUnit.unitId],
			set: { status: "visible", updatedAt: createdAt },
		});
	await tx.insert(realmUnitTag).values({
		realmId: targetRealm.id,
		unitId: target.id,
		tagId: targetTag.id,
		position: fractionalPositionAt(0),
		createdByProfileId: actor.id,
		createdAt,
		updatedAt: createdAt,
	});
	await tx.insert(realmTagContext).values({
		realmId: targetRealm.id,
		unitId: target.id,
		tagId: secondTag.id,
		contextPostId: contextPost.id,
		createdByProfileId: actor.id,
		createdAt,
		updatedAt: createdAt,
	});
	await tx.insert(realmTagVote).values([
		{
			realmId: targetRealm.id,
			unitId: target.id,
			tagId: secondTag.id,
			profileId: actor.id,
			value: 1,
			createdAt,
			updatedAt: createdAt,
		},
		{
			realmId: targetRealm.id,
			unitId: target.id,
			tagId: secondTag.id,
			profileId: collaborator.id,
			value: -1,
			createdAt,
			updatedAt: createdAt,
		},
	]);

	await createTagStructureInTransaction(tx, {
		memberTagIds: [targetTag.id, secondTag.id],
		profileId: actor.id,
		createdAt,
	});

	const [seedScore] = await tx.select({ id: score.id }).from(score).limit(1);
	if (!seedScore) throw new Error("Coverage scenario requires a Score");
	await tx.insert(postScore).values({
		postId: contextPost.id,
		scoreId: seedScore.id,
		position: fractionalPositionAt(0),
		createdAt,
		updatedAt: createdAt,
	});
	await tx.insert(realmScoreContext).values({
		realmId: targetRealm.id,
		contextPostId: contextPost.id,
		createdByProfileId: actor.id,
		createdAt,
		updatedAt: createdAt,
	});

	const [releaseUnit] = await insertUnits(tx, [
		{
			kind: "release",
			seedKey: "demo-release",
			ownerProfileId: actor.id,
			localizationKind: "description",
			status: "published",
			visibility: "public",
			moderationStatus: "approved",
			publishedAt: createdAt,
			createdAt,
			updatedAt: createdAt,
		},
	]);
	if (!releaseUnit) throw new Error("Coverage scenario failed to create a Release Unit");
	await insertUnitDetails(tx, data, [releaseUnit]);
	await tx.insert(release).values({
		id: releaseUnit.id,
		parentUnitId: itemAt(catalog.softwareUnits, 0).id,
		versionLabel: "1.0.0-seed",
		releasedOn: dateOnly(createdAt),
		createdAt,
		updatedAt: createdAt,
	});
	await recordUnitRevision(tx, {
		unitId: releaseUnit.id,
		actorProfileId: actor.id,
		event: "create",
		message: "Seeded release coverage scenario",
	});
}

async function seedHistory(
	tx: DatabaseTransaction,
	data: SeedData,
	profiles: readonly CreatedProfile[],
	catalog: SeedCatalog,
	content: SeedContent,
): Promise<void> {
	const structures = await tx
		.select({ id: contentStructure.id })
		.from(contentStructure)
		.where(isNull(contentStructure.deletedAt));
	for (const structure of structures) {
		if (await getContentStructureHeadRevision(tx, structure.id)) continue;
		await createContentStructureHistory(tx, {
			structureId: structure.id,
			state: await loadContentStructureSnapshot(tx, { structureId: structure.id }),
		});
	}
	const docks = await tx.select().from(unitDock).where(isNull(unitDock.deletedAt));
	for (const dock of docks) {
		if (await getDockRevisionId(tx, dock.id)) continue;
		await createDockHistory(tx, { dock });
	}

	const historyUnits = [
		...profiles.map((value) => ({ id: value.id, actorProfileId: value.id })),
		...[
			...catalog.entities,
			...catalog.tags,
			...catalog.works,
			...catalog.series,
			...catalog.realms,
			...catalog.zones,
			...catalog.collections,
			...catalog.polls,
			...content.allPosts,
		].map((value) => ({ id: value.id, actorProfileId: value.ownerProfileId })),
	];
	const initialRevisionByUnit = new Map<string, string>();
	for (const [index, value] of historyUnits.entries()) {
		const result = await recordUnitRevision(tx, {
			unitId: value.id,
			actorProfileId: value.actorProfileId,
			event: "create",
			message: "Seeded initial revision",
		});
		initialRevisionByUnit.set(value.id, result.revisionId);
		if ((index + 1) % 250 === 0) {
			console.info(`Recorded ${index + 1}/${historyUnits.length} initial seed revisions`);
		}
	}

	const updatedRevisionByUnit = new Map<string, string>();
	for (const [index, value] of catalog.works.slice(0, SeedPlan.historyUpdates).entries()) {
		await tx
			.update(unitLocalization)
			.set({
				summary: data.summary(itemAt(data.languages(index), 0)),
				updatedAt: data.referenceTime,
			})
			.where(
				and(
					eq(unitLocalization.unitId, value.id),
					isFirstUnitLocalization(unitLocalization.unitId),
				),
			);
		const baseRevisionId = initialRevisionByUnit.get(value.id);
		if (!baseRevisionId) throw new Error(`Missing initial seed revision for Unit ${value.id}`);
		const result = await recordUnitRevision(tx, {
			unitId: value.id,
			actorProfileId: value.ownerProfileId,
			event: "update",
			message: "Seeded localization update",
			baseRevisionId,
		});
		updatedRevisionByUnit.set(value.id, result.revisionId);
	}
	for (const value of catalog.works.slice(0, SeedPlan.historyRestores)) {
		const sourceRevisionId = initialRevisionByUnit.get(value.id);
		const baseRevisionId = updatedRevisionByUnit.get(value.id);
		if (!sourceRevisionId || !baseRevisionId) {
			throw new Error(`Missing seed revision chain for Unit ${value.id}`);
		}
		await restoreUnitRevision(tx, {
			unitId: value.id,
			sourceRevisionId,
			baseRevisionId,
			actorProfileId: value.ownerProfileId,
			message: "Seeded revision restore",
			authorization: new Authorization(value.ownerProfileId),
		});
	}
}

export interface SeedResult {
	readonly profile: SeedRunOptions["profile"];
	readonly referenceTime: Date;
	readonly scenarios: SeedRunOptions["scenarios"];
	readonly users: number;
	readonly recommendationEvents: number;
}

const RequiredSeedScenarios = [
	"identities",
	"catalog",
	"official-zone-content",
	"content",
	"structure",
	"interactions",
	"feature-contracts",
	"recommendations",
	"history",
] as const;

/**
 * Installs disposable development and test scenarios after Bootstrap has
 * established the production-safe system graph.
 */
export class DatabaseSeedService {
	async run(options: SeedRunOptions = createSeedRunOptions()): Promise<SeedResult> {
		assertLocalDatabaseUrl(env.DATABASE_URL);
		for (const scenario of RequiredSeedScenarios)
			if (!includesSeedScenario(options, scenario))
				throw new TypeError(`Seed profile ${options.profile} is missing ${scenario}`);
		if (!(await databaseBootstrapService.isReady())) {
			throw new Error(
				"Seed requires an independently bootstrapped database; run `task services-main:db:bootstrap` first",
			);
		}
		const data = createSeedData(options.referenceTime);
		const demoPasswordHash = await hashPassword(DemoCredentials.password);
		await database.transaction(
			async (tx) => {
				const [existingUser] = await tx
					.select({ id: users.id })
					.from(users)
					.where(notInArray(users.id, [...BootstrapAuthUserIds]))
					.limit(1);
				const [existingUnit] = await tx
					.select({ id: unit.id })
					.from(unit)
					.where(notInArray(unit.id, [...BootstrapUnitIds]))
					.limit(1);
				if (existingUser || existingUnit) {
					throw new Error(
						"Seed requires an empty database; run `task --yes local:reset`",
					);
				}

				console.info("Seeding identities scenario");
				const profiles = await seedProfiles(tx, data, demoPasswordHash);
				await ensureOfficialZoneFollows(
					tx,
					profiles.map(({ id }) => id),
					{ sequenceIsEmpty: true },
				);
				console.info("Seeding catalog scenario");
				const catalog = await seedCatalog(tx, data, profiles);
				console.info("Seeding official Zone content scenario");
				await seedToaruWiki(tx, data, profiles, catalog);
				console.info("Seeding content scenario");
				const content = await seedContent(tx, data, profiles, catalog);
				console.info("Seeding structure scenario");
				const structure = await seedStructure(tx, data, profiles, catalog, content);
				console.info("Seeding interactions scenario");
				await seedInteractions(tx, data, profiles, catalog, content);
				console.info("Seeding feature contracts scenario");
				await seedCoverageContracts(tx, data, profiles, catalog, content);
				if (includesSeedScenario(options, "communications")) {
					console.info("Seeding communications scenario");
					await seedCommunications(tx, data, profiles, content);
				}
				if (includesSeedScenario(options, "governance")) {
					console.info("Seeding governance scenario");
					await seedGovernance(tx, data, profiles, catalog, content, structure);
				}
				console.info("Seeding recommendation scenario");
				await seedRecommendations(tx, data, profiles, catalog, content);
				console.info("Seeding history scenario");
				await seedHistory(tx, data, profiles, catalog, content);
			},
			{ isolationLevel: "serializable" },
		);
		const result = {
			profile: options.profile,
			referenceTime: options.referenceTime,
			scenarios: options.scenarios,
			users: SeedPlan.users,
			recommendationEvents: SeedPlan.recommendationEvents,
		} satisfies SeedResult;
		console.info("Database Seed service completed", {
			...result,
			referenceTime: result.referenceTime.toISOString(),
			demoEmail: DemoCredentials.email,
			demoPassword: DemoCredentials.password,
			demoApiToken: DemoCredentials.apiToken,
		});
		return result;
	}
}

export const databaseSeedService = new DatabaseSeedService();
