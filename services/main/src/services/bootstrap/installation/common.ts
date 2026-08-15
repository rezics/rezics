import type { AvatarReference } from "@rezics/avatar";
import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import { unit, unitLocalization, unitOwnership, unitSlugAddress } from "../../database/schema";
import type { ContentLanguage } from "../../database/schema/contract-values";
import { insertUnit } from "../../units/create";
import { avatarReferenceToColumns } from "../../units/localization";
import { BootstrapEpochIso } from "../data";
import { bootstrapValuesEqual } from "../value-comparison";

export function bootstrapEpoch(): Date {
	return new Date(BootstrapEpochIso);
}

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

/** Installs an explicit reserved address; this never derives a slug from content. */
export async function ensureBootstrapAddressedUnit(
	tx: DatabaseTransaction,
	input: {
		readonly id: string;
		readonly kind: "profile" | "realm" | "zone";
		readonly scopeUnitId: string;
		readonly slug: string;
	},
): Promise<boolean> {
	const [existing] = await tx
		.select({
			id: unit.id,
			kind: unit.kind,
			status: unit.status,
			visibility: unit.visibility,
			deletedAt: unit.deletedAt,
		})
		.from(unit)
		.where(eq(unit.id, input.id))
		.limit(1);
	if (existing) {
		assertFields(`${input.kind} Unit ${input.slug}`, existing, {
			id: input.id,
			kind: input.kind,
			status: "published",
			visibility: "public",
			deletedAt: null,
		});
	} else {
		const createdAt = bootstrapEpoch();
		await insertUnit(tx, {
			id: input.id,
			kind: input.kind,
			status: "published",
			visibility: "public",
			publishedAt: createdAt,
			createdAt,
			updatedAt: createdAt,
			statusActor: { kind: "system" },
		});
	}

	const createdAt = bootstrapEpoch();
	const [canonicalAddress] = await tx
		.select({
			id: unitSlugAddress.id,
			scopeUnitId: unitSlugAddress.scopeUnitId,
			slug: unitSlugAddress.slug,
		})
		.from(unitSlugAddress)
		.where(and(eq(unitSlugAddress.kind, "canonical"), eq(unitSlugAddress.targetUnitId, input.id)))
		.limit(1);
	let addressChanged = false;
	if (canonicalAddress) {
		if (
			canonicalAddress.scopeUnitId !== input.scopeUnitId ||
			canonicalAddress.slug !== input.slug
		) {
			await tx
				.update(unitSlugAddress)
				.set({ scopeUnitId: input.scopeUnitId, slug: input.slug, updatedAt: createdAt })
				.where(eq(unitSlugAddress.id, canonicalAddress.id));
			addressChanged = true;
		}
	} else {
		await tx.insert(unitSlugAddress).values({
			kind: "canonical",
			scopeUnitId: input.scopeUnitId,
			slug: input.slug,
			targetUnitId: input.id,
			createdAt,
			updatedAt: createdAt,
		});
		addressChanged = true;
	}
	const [address] = await tx
		.select({
			kind: unitSlugAddress.kind,
			scopeUnitId: unitSlugAddress.scopeUnitId,
			slug: unitSlugAddress.slug,
			targetUnitId: unitSlugAddress.targetUnitId,
		})
		.from(unitSlugAddress)
		.where(and(eq(unitSlugAddress.kind, "canonical"), eq(unitSlugAddress.targetUnitId, input.id)))
		.limit(1);
	assertFields(`${input.kind} address ${input.slug}`, address, {
		kind: "canonical",
		scopeUnitId: input.scopeUnitId,
		slug: input.slug,
		targetUnitId: input.id,
	});
	return !existing || addressChanged;
}

export async function ensureLocalization(
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
): Promise<boolean> {
	const createdAt = bootstrapEpoch();
	const desired = {
		summary: input.summary ?? null,
		...avatarReferenceToColumns(input.avatar ?? null),
		content: input.content ?? null,
		contentStatus: input.contentStatus ?? null,
	};
	const [stored] = await tx
		.select({
			position: unitLocalization.position,
			title: unitLocalization.title,
			summary: unitLocalization.summary,
			avatarType: unitLocalization.avatarType,
			avatarAssetId: unitLocalization.avatarAssetId,
			avatarEmoji: unitLocalization.avatarEmoji,
			avatarIconPrefix: unitLocalization.avatarIconPrefix,
			avatarIconName: unitLocalization.avatarIconName,
			content: unitLocalization.content,
			contentStatus: unitLocalization.contentStatus,
		})
		.from(unitLocalization)
		.where(
			and(eq(unitLocalization.unitId, input.unitId), eq(unitLocalization.language, input.language)),
		)
		.limit(1);
	if (
		stored?.position === input.position &&
		stored.title === input.title &&
		stored.summary === desired.summary &&
		stored.avatarType === desired.avatarType &&
		stored.avatarAssetId === desired.avatarAssetId &&
		stored.avatarEmoji === desired.avatarEmoji &&
		stored.avatarIconPrefix === desired.avatarIconPrefix &&
		stored.avatarIconName === desired.avatarIconName &&
		bootstrapValuesEqual(stored.content, desired.content) &&
		stored.contentStatus === desired.contentStatus
	)
		return false;
	if (stored) {
		await tx
			.update(unitLocalization)
			.set({
				position: input.position,
				title: input.title,
				...desired,
				updatedAt: createdAt,
			})
			.where(
				and(
					eq(unitLocalization.unitId, input.unitId),
					eq(unitLocalization.language, input.language),
				),
			);
		return true;
	}
	await tx.insert(unitLocalization).values({
		unitId: input.unitId,
		language: input.language,
		position: input.position,
		title: input.title,
		...desired,
		createdAt,
		updatedAt: createdAt,
	});
	return true;
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
