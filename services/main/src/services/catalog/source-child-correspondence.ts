import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import {
	catalogSourceMappingClaim as claims,
	catalogSourceBindingRevision as revisions,
} from "@rezics/schema/postgres/ingestion/source";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import {
	bindCatalogSourceIdentity,
	lockCatalogSourceBinding,
	reviseCatalogSourceBinding,
} from "./source-bindings";

export type CatalogSourceChildCorrespondence = {
	mappingKey: string;
	correspondenceRevision: number;
};

/** @internal Resolve one checked root epoch. Referenced native children may have another owner. */
export async function resolveCatalogSourceChildCorrespondence(
	tx: DatabaseTransaction,
	sourceRecordId: string,
): Promise<CatalogSourceChildCorrespondence> {
	const [row] = await tx
		.select({
			mappingKey: claims.mappingKey,
			correspondenceRevision: revisions.correspondenceRevision,
		})
		.from(claims)
		.innerJoin(
			revisions,
			and(
				eq(revisions.sourceRecordId, claims.sourceRecordId),
				eq(revisions.mappingKey, claims.mappingKey),
				eq(revisions.revision, claims.bindingRevision),
			),
		)
		.where(and(eq(claims.sourceRecordId, sourceRecordId), eq(claims.path, "/")))
		.limit(1);
	if (!row) throw new Error("Source child correspondence requires an initialized root binding");
	return row;
}

/** @internal Run immediately after creating the root identity, before any own or referenced children. */
export async function prepareCatalogSourceChildCorrespondence(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		sourceRecordId: string;
		snapshotId: string;
		reference: CatalogReference;
		mappingVersion: string;
	},
): Promise<CatalogSourceChildCorrespondence> {
	const [claim] = await tx
		.select()
		.from(claims)
		.where(and(eq(claims.sourceRecordId, input.sourceRecordId), eq(claims.path, "/")))
		.limit(1);
	if (!claim) {
		await bindCatalogSourceIdentity(tx, actor, {
			...input,
			path: "/",
			initializing: true,
		});
	} else {
		const current = await lockCatalogSourceBinding(tx, {
			sourceRecordId: input.sourceRecordId,
			mappingKey: claim.mappingKey,
		});
		if (
			current.reference.owner !== input.reference.owner ||
			current.reference.id !== input.reference.id
		)
			throw new Error("Source child initialization cannot change its root target");
		if (current.claim.mappingVersion !== input.mappingVersion) {
			if (current.claim.observedSnapshotId !== null)
				throw new Error("Initialized source protocol changes require a reviewed binding revision");
			await reviseCatalogSourceBinding(tx, actor, {
				sourceRecordId: input.sourceRecordId,
				mappingKey: claim.mappingKey,
				expectedRevision: current.claim.bindingRevision,
				state: current.claim.state,
				mode: "review",
				reason: "Prepared exact native child mapping protocol",
				mappingVersion: input.mappingVersion,
			});
		}
	}
	return resolveCatalogSourceChildCorrespondence(tx, input.sourceRecordId);
}

/** @internal Seal new own-endpoint initialization only after every native child write succeeds. */
export async function sealCatalogSourceChildCorrespondence(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		sourceRecordId: string;
		snapshotId: string;
		reference: CatalogReference;
		mappingVersion?: string;
		path?: "/";
	},
) {
	const scope = await resolveCatalogSourceChildCorrespondence(tx, input.sourceRecordId);
	const current = await lockCatalogSourceBinding(tx, {
		sourceRecordId: input.sourceRecordId,
		mappingKey: scope.mappingKey,
	});
	if (
		current.reference.owner !== input.reference.owner ||
		current.reference.id !== input.reference.id ||
		current.claim.observedSnapshotId !== input.snapshotId ||
		current.claim.appliedCorrespondenceRevision !== null ||
		(input.mappingVersion !== undefined && input.mappingVersion !== current.claim.mappingVersion)
	)
		throw new Error("Source child initialization seal differs from its prepared root");
	const { loadCatalogIdentity } = await import("./storage");
	await loadCatalogIdentity(tx, input.reference, actor, true);
	await tx
		.update(claims)
		.set({ appliedCorrespondenceRevision: scope.correspondenceRevision })
		.where(
			and(eq(claims.sourceRecordId, input.sourceRecordId), eq(claims.mappingKey, scope.mappingKey)),
		);
}
