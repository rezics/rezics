import {
	LicenseRegistry,
	parseLicenseId,
	type LicenseDefinition,
	type LicenseId,
	type LicenseRecognitionStatus,
} from "@rezics/license";
import { and, eq, inArray, isNull } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { database } from "../database";
import { unit, unitLicenseGrant } from "../database/schema";
import {
	UnitLicenseGrantForbidden,
	UnitLicenseGrantConflict,
	UnitLicenseNotApplicable,
	UnitLicenseOfferingEndForbidden,
	UnitNotFound,
} from "./errors";

export type PresentedUnitLicenseGrant = {
	readonly id: string;
	readonly licenseId: LicenseId;
	readonly grantedByProfileId: string | null;
	readonly grantedAt: Date;
};

export type OpenUnitLicenseOffering = PresentedUnitLicenseGrant & {
	readonly recognitionStatus: LicenseRecognitionStatus;
};

function uniqueLicenseIds(ids: readonly string[]): LicenseId[] {
	const seen = new Set<LicenseId>();
	const unique: LicenseId[] = [];
	for (const value of ids) {
		const licenseId = parseLicenseId(value);
		if (seen.has(licenseId)) continue;
		seen.add(licenseId);
		unique.push(licenseId);
	}
	return unique;
}

function isPostgresUniqueViolation(error: unknown): boolean {
	for (let current = error; current; current = (current as { cause?: unknown }).cause) {
		if (
			typeof current === "object" &&
			current !== null &&
			"code" in current &&
			(current as { code: unknown }).code === "23505"
		)
			return true;
	}
	return false;
}

/**
 * Serializes license mutations on the Unit row. Callers that already hold the
 * same row lock may call this again; PostgreSQL will re-use the existing lock.
 */
export async function lockUnitForLicenseMutation(
	tx: DatabaseTransaction,
	unitId: string,
): Promise<{ readonly id: string; readonly kind: string }> {
	const [row] = await tx
		.select({ id: unit.id, kind: unit.kind })
		.from(unit)
		.where(eq(unit.id, unitId))
		.for("update")
		.limit(1);
	if (!row) throw new UnitNotFound();
	return row;
}

function assertGrantPreconditions(
	licenseIds: readonly LicenseId[],
	input: {
		readonly unitKind: string;
		readonly grantedByProfileId: string | null;
	},
): void {
	for (const licenseId of licenseIds) {
		const definition: LicenseDefinition = LicenseRegistry[licenseId];
		if (
			definition.applicableUnitKinds !== null &&
			!definition.applicableUnitKinds.some((kind) => kind === input.unitKind)
		)
			throw new UnitLicenseNotApplicable(licenseId, input.unitKind);
		if (definition.requiresAffirmativeAcknowledgement && !input.grantedByProfileId)
			throw new UnitLicenseGrantForbidden();
	}
}

export async function insertLicenseGrants(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly grantedByProfileId: string;
		readonly licenseIds: readonly string[];
		readonly unitKind: string;
	},
): Promise<void> {
	await lockUnitForLicenseMutation(tx, input.unitId);
	const licenseIds = uniqueLicenseIds(input.licenseIds);
	if (licenseIds.length === 0) return;
	assertGrantPreconditions(licenseIds, input);
	try {
		await tx.insert(unitLicenseGrant).values(
			licenseIds.map((licenseId) => ({
				unitId: input.unitId,
				licenseId,
				grantedByProfileId: input.grantedByProfileId,
			})),
		);
	} catch (error) {
		if (isPostgresUniqueViolation(error)) throw new UnitLicenseGrantConflict();
		throw error;
	}
}

export async function syncLicenseOfferings(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly actorProfileId: string;
		readonly desired: readonly string[];
		readonly unitKind: string;
	},
): Promise<void> {
	await lockUnitForLicenseMutation(tx, input.unitId);
	const desired = uniqueLicenseIds(input.desired);
	const desiredSet = new Set(desired);
	const existing = await tx
		.select({
			id: unitLicenseGrant.id,
			licenseId: unitLicenseGrant.licenseId,
		})
		.from(unitLicenseGrant)
		.where(and(eq(unitLicenseGrant.unitId, input.unitId), isNull(unitLicenseGrant.offeringEndedAt)))
		.for("update");
	const existingIds = new Set(existing.map((row) => row.licenseId));
	const toEnd = existing.filter((row) => !desiredSet.has(row.licenseId));
	const toGrant = desired.filter((licenseId) => !existingIds.has(licenseId));
	for (const row of toEnd) {
		if (!LicenseRegistry[row.licenseId].ownerMayEndOffering)
			throw new UnitLicenseOfferingEndForbidden(row.licenseId);
	}
	if (toEnd.length > 0)
		await tx
			.update(unitLicenseGrant)
			.set({
				offeringEndedAt: new Date(),
				offeringEndedByProfileId: input.actorProfileId,
			})
			.where(
				inArray(
					unitLicenseGrant.id,
					toEnd.map((row) => row.id),
				),
			);
	if (toGrant.length > 0)
		await insertLicenseGrants(tx, {
			unitId: input.unitId,
			grantedByProfileId: input.actorProfileId,
			licenseIds: toGrant,
			unitKind: input.unitKind,
		});
}

const openOfferingColumns = {
	id: unitLicenseGrant.id,
	licenseId: unitLicenseGrant.licenseId,
	grantedByProfileId: unitLicenseGrant.grantedByProfileId,
	grantedAt: unitLicenseGrant.grantedAt,
	recognitionStatus: unitLicenseGrant.recognitionStatus,
} as const;

function presentGrant(row: {
	readonly id: string;
	readonly licenseId: LicenseId;
	readonly grantedByProfileId: string | null;
	readonly grantedAt: Date;
}): PresentedUnitLicenseGrant {
	return {
		id: row.id,
		licenseId: row.licenseId,
		grantedByProfileId: row.grantedByProfileId,
		grantedAt: row.grantedAt,
	};
}

export async function listEffectiveUnitLicenses(
	unitId: string,
): Promise<readonly PresentedUnitLicenseGrant[]> {
	const rows = await database
		.select(openOfferingColumns)
		.from(unitLicenseGrant)
		.where(
			and(
				eq(unitLicenseGrant.unitId, unitId),
				isNull(unitLicenseGrant.offeringEndedAt),
				eq(unitLicenseGrant.recognitionStatus, "recognized"),
			),
		)
		.orderBy(unitLicenseGrant.grantedAt, unitLicenseGrant.id);
	return rows.map(presentGrant);
}

export async function listOpenUnitLicenseOfferings(
	unitId: string,
): Promise<readonly OpenUnitLicenseOffering[]> {
	const rows = await database
		.select(openOfferingColumns)
		.from(unitLicenseGrant)
		.where(and(eq(unitLicenseGrant.unitId, unitId), isNull(unitLicenseGrant.offeringEndedAt)))
		.orderBy(unitLicenseGrant.grantedAt, unitLicenseGrant.id);
	return rows.map((row) => ({
		...presentGrant(row),
		recognitionStatus: row.recognitionStatus,
	}));
}
