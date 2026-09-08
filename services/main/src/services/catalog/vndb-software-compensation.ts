import { and, desc, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import {
	softwareRecordRevision,
	softwareParticipationContextRevision,
} from "../database/schema/catalog-software";
import { softwareParticipationRevision } from "../database/schema/catalog-software-participation";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import {
	CatalogSourceNativeChangesSchema,
	readCatalogSourceApplication,
	type CatalogSourceNativeChange,
} from "./source-applications";
import { compensateCatalogSourceOwnedChange } from "./source-owned-compensation";
import { loadCatalogIdentity, recordCatalogChange } from "./storage";
import { reviseSoftwareContent, reviseSoftwareRelease, restoreSoftwareDetails } from "./software";
import { restoreSoftwareComponent, withdrawSoftwareComponent } from "./software-components";
import {
	restoreSoftwareParticipationContext,
	reviseSoftwareParticipationContext,
} from "./software-contexts";
import {
	restoreSoftwareParticipation,
	reviseSoftwareParticipation,
} from "./software-participation";

/** @internal Exact software inverse operations keep canonical identities and append native history. */
export async function compensateVndbSoftwareApplication(
	tx: DatabaseTransaction,
	context: Parameters<CatalogSourceNativeWriter>[1],
	shape: "content" | "release",
) {
	const application = await readCatalogSourceApplication(tx, context.actor, {
		sourceRecordId: context.sourceRecordId,
		proposalId: context.proposalId,
		action: "apply",
	});
	if (!application) throw new Error("VNDB withdrawal requires its exact native application");
	const changes: CatalogSourceNativeChange[] = [];
	let revision = context.expectedRevision;
	for (const change of [...application.changes].reverse()) {
		if (change.ownerId !== context.reference.id)
			throw new TypeError("VNDB software compensation cannot mutate another native owner");
		if (
			change.kind === "catalog-semantic" ||
			change.kind === "catalog-name" ||
			change.kind === "catalog-name-authority" ||
			change.kind === "catalog-identifier"
		) {
			changes.push(await compensateCatalogSourceOwnedChange(tx, context.actor, change));
			revision = (await loadCatalogIdentity(tx, context.reference, context.actor, true)).revision;
		} else if (change.kind === "software-component") {
			const result =
				change.beforeRevision === null
					? await withdrawSoftwareComponent(
							tx,
							context.reference,
							context.actor,
							revision,
							change.component,
							change.componentKey,
							change.afterRevision,
						)
					: await restoreSoftwareComponent(
							tx,
							context.reference,
							context.actor,
							revision,
							change.component,
							change.componentKey,
							change.afterRevision,
							change.beforeRevision,
						);
			revision = result.revision;
			changes.push({
				...change,
				beforeRevision: change.afterRevision,
				afterRevision: result.componentRevision,
			});
		} else if (change.kind === "software-record") {
			const result =
				change.beforeRevision !== null
					? await restoreSoftwareDetails(
							tx,
							context.reference,
							context.actor,
							revision,
							change.beforeRevision,
						)
					: shape === "content"
						? await reviseSoftwareContent(tx, context.reference, context.actor, revision, {})
						: await reviseSoftwareRelease(tx, context.reference, context.actor, revision, {});
			if (!result) throw new Error("Software record compensation failed");
			revision = result.revision;
			const t = softwareRecordRevision;
			const [restored] = await tx
				.select({ revision: t.revision })
				.from(t)
				.where(eq(t.ownerId, context.reference.id))
				.orderBy(desc(t.revision))
				.limit(1);
			if (!restored) throw new Error("Software compensation history is missing");
			if (restored.revision !== change.afterRevision)
				changes.push({
					...change,
					beforeRevision: change.afterRevision,
					afterRevision: restored.revision,
				});
		} else if (change.kind === "software-context") {
			let next: number;
			if (change.beforeRevision !== null)
				next = (
					await restoreSoftwareParticipationContext(
						tx,
						context.reference,
						context.actor,
						change.componentKey,
						change.afterRevision,
						change.beforeRevision,
					)
				).revision;
			else {
				const t = softwareParticipationContextRevision;
				const [value] = await tx
					.select()
					.from(t)
					.where(
						and(
							eq(t.contentId, context.reference.id),
							eq(t.contextId, change.componentKey),
							eq(t.revision, change.afterRevision),
						),
					)
					.limit(1);
				if (!value) throw new Error("Created source context history is missing");
				next = (
					await reviseSoftwareParticipationContext(
						tx,
						context.reference,
						context.actor,
						change.componentKey,
						change.afterRevision,
						{ label: value.label, languageTag: value.languageTag, state: "withdrawn" },
					)
				).revision;
			}
			changes.push({ ...change, beforeRevision: change.afterRevision, afterRevision: next });
		} else if (change.kind === "software-participation") {
			let next: number;
			if (change.beforeRevision !== null)
				next = (
					await restoreSoftwareParticipation(
						tx,
						context.reference,
						context.actor,
						change.componentKey,
						change.afterRevision,
						change.beforeRevision,
					)
				).revision;
			else {
				const t = softwareParticipationRevision;
				const [value] = await tx
					.select()
					.from(t)
					.where(
						and(
							eq(t.contentId, context.reference.id),
							eq(t.participationId, change.componentKey),
							eq(t.revision, change.afterRevision),
						),
					)
					.limit(1);
				if (!value) throw new Error("Created source participation history is missing");
				next = (
					await reviseSoftwareParticipation(
						tx,
						context.reference,
						context.actor,
						change.componentKey,
						change.afterRevision,
						{
							entityId: value.entityId,
							name:
								value.nameId && value.nameRevision
									? { id: value.nameId, revision: value.nameRevision }
									: null,
							context:
								value.contextId && value.contextRevision
									? { id: value.contextId, revision: value.contextRevision }
									: null,
							characterId: value.characterId,
							roleRevisionId: value.roleRevisionId,
							note: value.note,
							state: "withdrawn",
						},
					)
				).revision;
			}
			changes.push({ ...change, beforeRevision: change.afterRevision, afterRevision: next });
		} else throw new TypeError("Unexpected family in a VNDB software application");
	}
	revision = await recordCatalogChange(
		tx,
		context.reference,
		context.actor,
		revision,
		`source.vndb.${shape}.withdraw`,
	);
	return { revision, changes: CatalogSourceNativeChangesSchema.parse(changes) };
}
