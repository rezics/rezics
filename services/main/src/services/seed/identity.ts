import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { PlatformOwner, UnitOwner } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import { authEntity } from "../database/schema/participation";
import {
	BootstrapEpochUnixMilliseconds,
	BootstrapPlatformAdministratorProfile,
} from "../bootstrap/data";
import { unitOwnerTable } from "../database/schema/unit-reference-columns";
import { insertPlatformUnit, type CreatePlatformUnitInput } from "../units/create";
import {
	runWithParticipationAuthority,
	type ParticipationAuthority,
} from "../participation/policy";
import type {
	ResourceVisibility,
	UnitStatusValues,
	ModerationStatusValues,
} from "../database/schema/contract-values";

export type SeedIdentityDescriptor = {
	readonly kind: UnitOwner;
	readonly seedKey: string;
	readonly ownerProfileId: string;
	readonly status: (typeof UnitStatusValues)[number];
	readonly visibility: ResourceVisibility;
	readonly moderationStatus: (typeof ModerationStatusValues)[number];
	readonly publishedAt: Date | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
};

const prepared = new WeakMap<DatabaseTransaction, Map<string, SeedIdentityDescriptor>>();
const authorities = new WeakMap<DatabaseTransaction, Map<string, ParticipationAuthority>>();

/** Stable fixture addressing is independent of randomized account IDs and generated copy. */
export function seedFixtureIdentityId(owner: UnitOwner, seedKey: string): string {
	const timestamp = BootstrapEpochUnixMilliseconds.toString(16).padStart(12, "0");
	const hash = createHash("sha256")
		.update(`rezics.native.seed.1:${owner}:${seedKey}`)
		.digest("hex");
	return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7${hash.slice(0, 3)}-8${hash.slice(3, 6)}-${hash.slice(6, 18)}`;
}

/** Prepares bounded in-memory fixture references; it writes no placeholder or universal identity row. */
export function prepareFixtureIdentities<T extends SeedIdentityDescriptor>(
	tx: DatabaseTransaction,
	descriptors: readonly T[],
) {
	let registry = prepared.get(tx);
	if (!registry) {
		registry = new Map();
		prepared.set(tx, registry);
	}
	return descriptors.map((descriptor) => {
		if (
			!Number.isSafeInteger(descriptor.createdAt.getTime()) ||
			descriptor.createdAt.getTime() < 0 ||
			descriptor.createdAt.getTime() >= 2 ** 48
		)
			throw new Error("Fixture creation timestamp is outside UUIDv7 range");
		const id = seedFixtureIdentityId(descriptor.kind, descriptor.seedKey);
		if (registry.has(id)) throw new Error(`Duplicate seed identity ${descriptor.seedKey}`);
		if (registry.size >= 10_000) throw new Error("Synthetic fixture identity budget exceeded");
		registry.set(id, descriptor);
		return { ...descriptor, id };
	});
}

export async function seedAuthority(
	tx: DatabaseTransaction,
	publicAuthorId: string,
): Promise<ParticipationAuthority> {
	let cache = authorities.get(tx);
	if (!cache) {
		cache = new Map();
		authorities.set(tx, cache);
	}
	const cached = cache.get(publicAuthorId);
	if (cached) return cached;
	const [binding] = await tx
		.select()
		.from(authEntity)
		.where(eq(authEntity.entityId, publicAuthorId))
		.limit(1);
	if (binding?.state === "active") {
		const authority: ParticipationAuthority = {
			principal: { kind: "auth", authUserId: binding.authUserId },
			actingEntityId: binding.entityId,
			authorizationRevision: binding.revision,
		};
		cache.set(publicAuthorId, authority);
		return authority;
	}
	if (publicAuthorId === BootstrapPlatformAdministratorProfile.profileId)
		throw new Error("Bootstrap operator has no active Auth binding");
	// Official organization authorship is separate from the administrator who installs fixtures.
	return seedAuthority(tx, BootstrapPlatformAdministratorProfile.profileId);
}

export async function withSeedAuthority<T>(
	tx: DatabaseTransaction,
	publicAuthorId: string,
	work: (authority: ParticipationAuthority) => Promise<T>,
): Promise<T> {
	const authority = await seedAuthority(tx, publicAuthorId);
	return runWithParticipationAuthority(authority, () => work(authority));
}

type SeedPlatformRows = {
	[Owner in PlatformOwner]: {
		readonly owner: Owner;
		readonly rows: readonly (Extract<CreatePlatformUnitInput, { owner: Owner }>["values"] & {
			id: string;
		})[];
	};
}[PlatformOwner];

/** One complete owner insert records lifecycle and private operator provenance together. */
export async function insertSeedPlatformRows(
	tx: DatabaseTransaction,
	input: SeedPlatformRows,
): Promise<void> {
	for (const [index, row] of input.rows.entries()) {
		const descriptor = prepared.get(tx)?.get(row.id);
		if (!descriptor || descriptor.kind !== input.owner)
			throw new Error("Unprepared concrete seed owner");
		const authority = await seedAuthority(tx, descriptor.ownerProfileId);
		const metadata = {
			id: row.id,
			status: descriptor.status,
			visibility: descriptor.visibility,
			moderationStatus: descriptor.moderationStatus,
			publishedAt: descriptor.publishedAt,
			createdAt: descriptor.createdAt,
			updatedAt: descriptor.updatedAt,
			createdByAuthUserId: authority.principal.authUserId,
		};
		// Dispatch remains explicit because each physical owner has its own required fields.
		switch (input.owner) {
			case "video":
				await insertPlatformUnit(tx, {
					owner: "video",
					values: { ...input.rows[index]!, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
			case "audio":
				await insertPlatformUnit(tx, {
					owner: "audio",
					values: { ...input.rows[index]!, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
			case "post":
				await insertPlatformUnit(tx, {
					owner: "post",
					values: { ...input.rows[index]!, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
			case "poll":
				await insertPlatformUnit(tx, {
					owner: "poll",
					values: { ...input.rows[index]!, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
			case "zone":
				await insertPlatformUnit(tx, {
					owner: "zone",
					values: { ...input.rows[index]!, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
			case "realm":
				await insertPlatformUnit(tx, {
					owner: "realm",
					values: { ...input.rows[index]!, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
			case "realm_rule":
				await insertPlatformUnit(tx, {
					owner: "realm_rule",
					values: { ...input.rows[index]!, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
			case "collection":
				await insertPlatformUnit(tx, {
					owner: "collection",
					values: { ...input.rows[index]!, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
			case "tag":
				await insertPlatformUnit(tx, {
					owner: "tag",
					values: { ...input.rows[index]!, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
			case "tag_path":
				await insertPlatformUnit(tx, {
					owner: "tag_path",
					values: { ...input.rows[index]!, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
			case "label":
				await insertPlatformUnit(tx, {
					owner: "label",
					values: { ...input.rows[index]!, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
			case "custom_theme":
				await insertPlatformUnit(tx, {
					owner: "custom_theme",
					values: { ...input.rows[index]!, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
		}
	}
}

export async function assertPreparedFixtureIdentitiesStored(
	tx: DatabaseTransaction,
): Promise<void> {
	const registry = prepared.get(tx);
	if (!registry) return;
	for (const owner of new Set([...registry.values()].map((value) => value.kind))) {
		const ids = [...registry].filter(([, value]) => value.kind === owner).map(([id]) => id);
		const table = unitOwnerTable(owner);
		const rows = await tx.select({ id: table.id }).from(table).where(inArray(table.id, ids));
		if (rows.length !== ids.length) throw new Error(`Seed has unmaterialized ${owner} identities`);
	}
}
