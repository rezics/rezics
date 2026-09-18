import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	publishingPublicationFacet,
	publishingReleaseEvent,
} from "@rezics/schema/postgres/publishing/publishing";
import { CatalogPartialDateSchema, type CatalogReference } from "@rezics/schema/contracts/native/catalog";
import { assertCatalogDefinitionTarget } from "./definitions";
import { assertReadableTargets, loadCatalogIdentity, recordCatalogChange } from "./storage";
import {
	PublishingCoverageSchema,
	PublishingInstallmentSchema,
	putPublishingCoverage,
	removePublishingCoverage,
	putPublishingInstallment,
	removePublishingInstallment,
} from "./publishing";

export const PublishingEventValuesSchema = z.strictObject({
	kind: z.literal("event"),
	publisherEntityId: z.uuid().nullable().default(null),
	publisherCredit: z.string().max(131072).nullable().default(null),
	areaId: z.uuid().nullable().default(null),
	date: CatalogPartialDateSchema.default({ year: null, month: null, day: null }),
	dateText: z.string().max(4096).nullable().default(null),
});
export const PublishingComponentValuesSchema = z.discriminatedUnion("kind", [
	...PublishingCoverageSchema.options,
	z.strictObject({ kind: z.literal("facet"), definitionRevisionId: z.uuid() }),
	PublishingEventValuesSchema,
	PublishingInstallmentSchema.omit({ id: true }).extend({ kind: z.literal("installment") }),
]);
export type PublishingComponentValue = z.output<typeof PublishingComponentValuesSchema>;
export const PublishingComponentKinds = {
	text_work: "publishing_text_work",
	publication_text: "publishing_publication_text",
	publication_work: "publishing_publication_work",
	facet: "publishing_publication_facet",
	event: "publishing_release_event",
	installment: "publishing_installment",
} as const;

/** @internal Native child commands enforce ownership and concrete target semantics before recording history. */
export async function putPublishingComponent(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	key: string,
	input: z.input<typeof PublishingComponentValuesSchema>,
) {
	const value = PublishingComponentValuesSchema.parse(input);
	z.uuid().parse(key);
	if (reference.owner !== "publishing") throw new TypeError("Expected publishing owner");
	if (
		value.kind === "text_work" ||
		value.kind === "publication_work" ||
		value.kind === "publication_text"
	) {
		if (value.targetId !== key)
			throw new TypeError("Coverage target differs from component identity");
		return putPublishingCoverage(tx, reference, actor, expectedRevision, value);
	}
	if (value.kind === "installment") {
		const { kind, ...fields } = value;
		return putPublishingInstallment(tx, reference, actor, expectedRevision, { ...fields, id: key });
	}
	const identity = await loadCatalogIdentity(tx, reference, actor, true);
	if (identity.shape !== "publication")
		throw new TypeError("Publication component requires a publication");
	if (value.kind === "facet") {
		if (value.definitionRevisionId !== key)
			throw new TypeError("Facet differs from component identity");
		await assertCatalogDefinitionTarget(
			tx,
			value.definitionRevisionId,
			"vocabulary",
			{ owner: "publishing", shape: "publication" },
			"facet",
		);
	} else {
		// Keeping an existing pointer does not read that foreign resource or create new access to it.
		const [current] = await tx
			.select({
				publisherEntityId: publishingReleaseEvent.publisherEntityId,
				areaId: publishingReleaseEvent.areaId,
			})
			.from(publishingReleaseEvent)
			.where(
				and(
					eq(publishingReleaseEvent.publicationId, reference.id),
					eq(publishingReleaseEvent.id, key),
				),
			)
			.limit(1);
		await assertReadableTargets(
			tx,
			[
				...(value.publisherEntityId && value.publisherEntityId !== current?.publisherEntityId
					? [{ owner: "entity" as const, id: value.publisherEntityId }]
					: []),
				...(value.areaId && value.areaId !== current?.areaId
					? [{ owner: "reference" as const, id: value.areaId }]
					: []),
			],
			actor,
		);
	}
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		`publishing.${value.kind}.put`,
	);
	if (value.kind === "facet")
		await tx
			.insert(publishingPublicationFacet)
			.values({ publicationId: reference.id, definitionRevisionId: key })
			.onConflictDoUpdate({
				target: [
					publishingPublicationFacet.publicationId,
					publishingPublicationFacet.definitionRevisionId,
				],
				set: { definitionRevisionId: key },
			});
	else {
		const { kind, date, ...fields } = value;
		await tx
			.insert(publishingReleaseEvent)
			.values({
				publicationId: reference.id,
				id: key,
				...fields,
				dateYear: date.year,
				dateMonth: date.month,
				dateDay: date.day,
			})
			.onConflictDoUpdate({
				target: [publishingReleaseEvent.publicationId, publishingReleaseEvent.id],
				set: { ...fields, dateYear: date.year, dateMonth: date.month, dateDay: date.day },
			});
	}
	return { revision };
}
/** @internal Removes exactly one child and preserves its immutable history. */
export async function removePublishingComponent(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	kind: PublishingComponentValue["kind"],
	key: string,
) {
	z.uuid().parse(key);
	if (reference.owner !== "publishing") throw new TypeError("Expected publishing owner");
	if (kind === "text_work" || kind === "publication_work" || kind === "publication_text")
		return removePublishingCoverage(tx, reference, actor, expectedRevision, kind, key);
	if (kind === "installment")
		return removePublishingInstallment(tx, reference, actor, expectedRevision, key);
	const identity = await loadCatalogIdentity(tx, reference, actor, true);
	if (identity.shape !== "publication")
		throw new TypeError("Publication component requires a publication");
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		`publishing.${kind}.remove`,
	);
	if (kind === "facet")
		await tx
			.delete(publishingPublicationFacet)
			.where(
				and(
					eq(publishingPublicationFacet.publicationId, reference.id),
					eq(publishingPublicationFacet.definitionRevisionId, key),
				),
			);
	else
		await tx
			.delete(publishingReleaseEvent)
			.where(
				and(
					eq(publishingReleaseEvent.publicationId, reference.id),
					eq(publishingReleaseEvent.id, key),
				),
			);
	return { revision };
}
/** @internal Checked conversion of native immutable row snapshots, without private Auth attribution. */
export function publishingComponentRevisionValue(
	component: string,
	row: Record<string, unknown>,
): PublishingComponentValue {
	const date = { year: row.date_year, month: row.date_month, day: row.date_day };
	if (
		component === "publishing_text_work" ||
		component === "publishing_publication_text" ||
		component === "publishing_publication_work"
	)
		return PublishingComponentValuesSchema.parse({
			kind:
				component === "publishing_text_work"
					? "text_work"
					: component === "publishing_publication_text"
						? "publication_text"
						: "publication_work",
			targetId: component === "publishing_publication_text" ? row.text_version_id : row.work_id,
			position: row.position,
			coverageText: row.coverage_text,
		});
	if (component === "publishing_publication_facet")
		return PublishingComponentValuesSchema.parse({
			kind: "facet",
			definitionRevisionId: row.definition_revision_id,
		});
	if (component === "publishing_release_event")
		return PublishingComponentValuesSchema.parse({
			kind: "event",
			publisherEntityId: row.publisher_entity_id,
			publisherCredit: row.publisher_credit,
			areaId: row.area_id,
			date,
			dateText: row.date_text,
		});
	if (component === "publishing_installment")
		return PublishingComponentValuesSchema.parse({
			kind: "installment",
			parentId: row.parent_id,
			position: row.position,
			label: row.label,
			kindRevisionId: row.kind_revision_id,
			date,
			dateText: row.date_text,
		});
	throw new TypeError("Unknown Publishing child history component");
}
