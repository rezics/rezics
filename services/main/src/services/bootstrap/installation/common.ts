import type { AvatarReference } from "@rezics/avatar";
import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import { unitLocalization, unitOwnership, unitSlugAddress } from "../../database/schema";
import type { ContentLanguage } from "@rezics/schema/postgres/shared/contract-values";
import { insertPlatformUnit, type CreatePlatformUnitInput } from "../../units/create";
import { unitOwnerTable } from "@rezics/schema/postgres/shared/unit-reference-columns";
import { avatarReferenceToColumns } from "../../units/localization";
import { BootstrapEpochIso, BootstrapPlatformAdministratorProfile } from "../data";
import { bootstrapValuesEqual } from "../value-comparison";

export function bootstrapEpoch(): Date {
	return new Date(BootstrapEpochIso);
}

/** Asserts identity invariants only. Product-owned fields must not appear here. */
export function assertFields(
	label: string,
	actual: Record<string, unknown> | undefined,
	expected: Record<string, unknown>,
): void {
	if (!actual) throw new Error(`Bootstrap ${label} was not created`);
	for (const [key, expectedValue] of Object.entries(expected)) {
		if (!bootstrapValuesEqual(actual[key], expectedValue))
			throw new Error(
				`Bootstrap ${label} has unexpected ${key}: expected ${String(expectedValue)}, received ${String(actual[key])}`,
			);
	}
}

/**
 * Ensures a reserved Unit ID exists with the declared kind.
 * Inserts the factory canonical slug only when that Unit has no canonical address.
 * Never updates an existing address, status, visibility, or deletion state.
 */
type BootstrapAddressedInput = {
	[Owner in "realm" | "tag" | "zone"]: Omit<
		Extract<CreatePlatformUnitInput, { owner: Owner }>,
		"statusActor"
	> & {
		readonly id: string;
		readonly scopeNamespaceId: string;
		readonly slug: string;
	};
}["realm" | "tag" | "zone"];

export async function ensureBootstrapAddressedUnit(
	tx: DatabaseTransaction,
	input: BootstrapAddressedInput,
): Promise<boolean> {
	const table = unitOwnerTable(input.owner);
	const [existing] = await tx
		.select({ id: table.id })
		.from(table)
		.where(eq(table.id, input.id))
		.limit(1);
	if (!existing) {
		const createdAt = bootstrapEpoch();
		const metadata = {
			id: input.id,
			status: "published" as const,
			visibility: "public" as const,
			publishedAt: createdAt,
			createdAt,
			updatedAt: createdAt,
			createdByAuthUserId: BootstrapPlatformAdministratorProfile.authUserId,
		};
		switch (input.owner) {
			case "realm":
				await insertPlatformUnit(tx, {
					owner: input.owner,
					values: { ...input.values, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
			case "tag":
				await insertPlatformUnit(tx, {
					owner: input.owner,
					values: { ...input.values, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
			case "zone":
				await insertPlatformUnit(tx, {
					owner: input.owner,
					values: { ...input.values, ...metadata },
					statusActor: { kind: "system" },
				});
				break;
		}
	}

	const createdAt = bootstrapEpoch();
	const [canonicalAddress] = await tx
		.select({ id: unitSlugAddress.id })
		.from(unitSlugAddress)
		.where(and(eq(unitSlugAddress.kind, "canonical"), eq(unitSlugAddress.targetUnitId, input.id)))
		.limit(1);
	if (!canonicalAddress)
		await tx.insert(unitSlugAddress).values({
			kind: "canonical",
			scopeNamespaceId: input.scopeNamespaceId,
			slug: input.slug,
			targetUnitId: input.id,
			createdAt,
			updatedAt: createdAt,
		});
	return !existing;
}

/** First-write starter copy for a newly created reserved Unit. Never updates. */
export async function insertStarterLocalization(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly language: ContentLanguage;
		readonly position: string;
		readonly title: string;
		readonly summary?: string;
		readonly avatar?: AvatarReference | null;
		readonly content?: unknown;
		readonly contentStatus?: "published" | null;
	},
): Promise<void> {
	const createdAt = bootstrapEpoch();
	await tx
		.insert(unitLocalization)
		.values({
			unitId: input.unitId,
			language: input.language,
			position: input.position,
			title: input.title,
			summary: input.summary ?? null,
			...avatarReferenceToColumns(input.avatar ?? null),
			content: input.content ?? null,
			contentStatus: input.contentStatus ?? null,
			createdAt,
			updatedAt: createdAt,
		})
		.onConflictDoNothing();
}

export async function ensureOwnership(
	tx: DatabaseTransaction,
	unitId: string,
	ownerProfileId: string,
): Promise<boolean> {
	const [owner] = await tx
		.select({
			id: unitOwnership.id,
			profileId: unitOwnership.profileId,
		})
		.from(unitOwnership)
		.where(and(eq(unitOwnership.unitId, unitId), isNull(unitOwnership.revokedAt)))
		.limit(1);
	if (owner) {
		if (owner.profileId !== ownerProfileId)
			throw new Error(`Bootstrap Unit ${unitId} has an unexpected active owner`);
		return false;
	}
	await tx.insert(unitOwnership).values({
		unitId,
		profileId: ownerProfileId,
		assignedByProfileId: ownerProfileId,
		createdAt: bootstrapEpoch(),
		updatedAt: bootstrapEpoch(),
	});
	return true;
}
