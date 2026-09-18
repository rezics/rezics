import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	softwareComponentRevision,
	softwareRelease,
	softwareVersion,
} from "@rezics/schema/postgres/software/software";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import { SoftwareReleaseComponentSchema } from "./software";
import { SoftwareAnimationSchema } from "./software-animation";
import { CatalogRevisionConflict, loadCatalogIdentity, recordCatalogChange } from "./storage";

/** @alpha @remarks Complete native occurrence values, including the five bounded animation contexts. */
export const SoftwareComponentValuesSchema = z.discriminatedUnion("kind", [
	...SoftwareReleaseComponentSchema.options,
	SoftwareAnimationSchema.safeExtend({ kind: z.literal("animation") }),
]);
type Component = z.output<typeof SoftwareComponentValuesSchema>;
export type SoftwareComponentKind = Component["kind"];
const tables = {
	content: ["software_release_content", "id"],
	platform: ["software_release_platform", "platform_revision_id"],
	medium: ["software_release_medium", "id"],
	language: ["software_release_language", "id"],
	event: ["software_release_event", "id"],
	patch_target: ["software_patch_target", "base_release_id"],
	animation: ["software_release_animation", "context"],
} as const;
const revisionNumber = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

function componentKey(kind: SoftwareComponentKind, id: string) {
	return kind === "animation"
		? SoftwareAnimationSchema.shape.context.parse(id)
		: z.uuid().parse(id);
}

/** @alpha @remarks Decode trigger snapshots through the same checked values consumed by native writes. */
export function decodeSoftwareComponentSnapshot(
	kind: SoftwareComponentKind,
	input: unknown,
): Component {
	const v = z.record(z.string(), z.unknown()).parse(input);
	switch (kind) {
		case "content":
			return SoftwareReleaseComponentSchema.parse({
				kind,
				contentId: v.content_id,
				versionId: v.version_id,
				releaseTypeRevisionId: v.release_type_revision_id,
			});
		case "platform":
			return SoftwareReleaseComponentSchema.parse({
				kind,
				platformRevisionId: v.platform_revision_id,
			});
		case "medium":
			return SoftwareReleaseComponentSchema.parse({
				kind,
				mediumTypeRevisionId: v.medium_type_revision_id,
				quantity: v.quantity,
			});
		case "language":
			return SoftwareReleaseComponentSchema.parse({
				kind,
				languageTag: v.language_tag,
				channelRevisionId: v.channel_revision_id,
				machineTranslated: v.machine_translated,
				main: v.main,
				title: v.title,
				transliteratedTitle: v.transliterated_title,
			});
		case "event":
			return SoftwareReleaseComponentSchema.parse({
				kind,
				areaId: v.area_id,
				date: { year: v.date_year, month: v.date_month, day: v.date_day, text: v.date_text },
			});
		case "patch_target":
			return SoftwareReleaseComponentSchema.parse({
				kind,
				baseReleaseId: v.base_release_id,
				compatibility: v.compatibility,
			});
		case "animation":
			return {
				kind,
				...SoftwareAnimationSchema.parse({
					context: v.context,
					state: v.state,
					handDrawn: v.hand_drawn,
					vectorial: v.vectorial,
					threeDimensional: v.three_dimensional,
					liveAction: v.live_action,
					frequency: v.frequency,
				}),
			};
	}
}

async function requireRelease(tx: DatabaseTransaction, reference: CatalogReference, actor: string) {
	const identity = await loadCatalogIdentity(tx, reference, actor, true);
	if (reference.owner !== "software" || identity.shape !== "release")
		throw new TypeError("Expected software release");
}
async function head(
	tx: DatabaseTransaction,
	releaseId: string,
	kind: SoftwareComponentKind,
	componentId: string,
) {
	const t = softwareComponentRevision;
	const [row] = await tx
		.select()
		.from(t)
		.where(and(eq(t.releaseId, releaseId), eq(t.kind, kind), eq(t.componentId, componentId)))
		.orderBy(desc(t.revision))
		.limit(1);
	return row;
}
async function fence(
	tx: DatabaseTransaction,
	releaseId: string,
	kind: SoftwareComponentKind,
	componentId: string,
	expected: number | null,
) {
	if (expected !== null) revisionNumber.parse(expected);
	const current = await head(tx, releaseId, kind, componentId);
	if ((current?.revision ?? null) !== expected)
		throw new CatalogRevisionConflict("Software occurrence revision changed");
	return current;
}
async function values(
	tx: DatabaseTransaction,
	actor: string,
	releaseId: string,
	id: string,
	v: Component,
): Promise<Record<string, string | number | boolean | null>> {
	const software = async (targetId: string, shape: string) => {
		const identity = await loadCatalogIdentity(
			tx,
			{ owner: "software", id: targetId },
			actor,
			false,
		);
		if (identity.shape !== shape) throw new TypeError(`Expected software ${shape}`);
	};
	switch (v.kind) {
		case "content": {
			await software(v.contentId, "content");
			if (v.versionId) {
				await software(v.versionId, "version");
				const [version] = await tx
					.select({ contentId: softwareVersion.contentId })
					.from(softwareVersion)
					.where(eq(softwareVersion.id, v.versionId))
					.limit(1);
				if (version?.contentId !== v.contentId)
					throw new TypeError("Version belongs to another content");
			}
			return {
				id,
				content_id: v.contentId,
				version_id: v.versionId,
				release_type_revision_id: v.releaseTypeRevisionId,
			};
		}
		case "platform":
			if (id !== v.platformRevisionId)
				throw new TypeError("Platform occurrence identity cannot change");
			return { platform_revision_id: v.platformRevisionId };
		case "medium":
			return { id, medium_type_revision_id: v.mediumTypeRevisionId, quantity: v.quantity };
		case "language":
			return {
				id,
				language_tag: v.languageTag,
				channel_revision_id: v.channelRevisionId,
				machine_translated: v.machineTranslated,
				main: v.main,
				title: v.title,
				transliterated_title: v.transliteratedTitle,
			};
		case "event": {
			if (v.areaId) {
				const area = await loadCatalogIdentity(
					tx,
					{ owner: "reference", id: v.areaId },
					actor,
					false,
				);
				if (area.shape !== "area") throw new TypeError("Release territory requires an Area");
			}
			return {
				id,
				area_id: v.areaId,
				date_year: v.date.year,
				date_month: v.date.month,
				date_day: v.date.day,
				date_text: v.date.text,
			};
		}
		case "patch_target": {
			if (id !== v.baseReleaseId)
				throw new TypeError("Patch target occurrence identity cannot change");
			await software(v.baseReleaseId, "release");
			const [release] = await tx
				.select({ patch: softwareRelease.isPatch })
				.from(softwareRelease)
				.where(eq(softwareRelease.id, releaseId))
				.limit(1);
			if (release?.patch !== true) throw new TypeError("Only patches can declare base releases");
			return { base_release_id: v.baseReleaseId, compatibility: v.compatibility };
		}
		case "animation":
			if (id !== v.context) throw new TypeError("Animation context cannot change");
			return {
				context: v.context,
				state: v.state,
				hand_drawn: v.handDrawn,
				vectorial: v.vectorial,
				three_dimensional: v.threeDimensional,
				live_action: v.liveAction,
				frequency: v.frequency,
			};
	}
}

/** @alpha @remarks Exact child-history CAS preserves occurrence identity through edits and reinsertions. */
export async function putSoftwareComponent(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	componentId: string,
	expectedComponentRevision: number | null,
	input: z.input<typeof SoftwareComponentValuesSchema>,
) {
	const value = SoftwareComponentValuesSchema.parse(input);
	componentKey(value.kind, componentId);
	await requireRelease(tx, reference, actor);
	await fence(tx, reference.id, value.kind, componentId, expectedComponentRevision);
	const row = {
		release_id: reference.id,
		...(await values(tx, actor, reference.id, componentId, value)),
	};
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"software.component.put",
	);
	const [table, key] = tables[value.kind];
	const entries = Object.entries(row);
	const mutable = entries.filter(([column]) => column !== "release_id" && column !== key);
	// Table and column identifiers come only from the closed native mapping above.
	const conflict = mutable.length
		? sql`do update set ${sql.join(
				mutable.map(([column, value]) => sql`${sql.identifier(column)} = ${value}`),
				sql`, `,
			)}`
		: sql`do nothing`;
	await tx.execute(
		sql`insert into ${sql.identifier(table)} (${sql.join(
			entries.map(([column]) => sql.identifier(column)),
			sql`, `,
		)}) values (${sql.join(
			entries.map(([, value]) => sql`${value}`),
			sql`, `,
		)}) on conflict (${sql.identifier("release_id")}, ${sql.identifier(key)}) ${conflict}`,
	);
	const result = await head(tx, reference.id, value.kind, componentId);
	if (!result || result.operation !== "put")
		throw new Error("Software occurrence did not publish a snapshot");
	return { revision, componentRevision: result.revision, componentId };
}

/** @alpha @remarks Withdrawal records a tombstone and refuses stale occurrence heads. */
export async function withdrawSoftwareComponent(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	kind: SoftwareComponentKind,
	componentId: string,
	expectedComponentRevision: number,
) {
	componentKey(kind, componentId);
	await requireRelease(tx, reference, actor);
	const current = await fence(tx, reference.id, kind, componentId, expectedComponentRevision);
	if (!current || current.operation !== "put")
		throw new CatalogRevisionConflict("Software occurrence is already absent");
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"software.component.withdraw",
	);
	const [table, key] = tables[kind];
	await tx.execute(
		sql`delete from ${sql.identifier(table)} where release_id = ${reference.id}::uuid and ${sql.identifier(key)} = ${componentId}`,
	);
	const removed = await head(tx, reference.id, kind, componentId);
	if (removed?.operation !== "remove" || removed.revision !== revision)
		throw new Error("Software occurrence withdrawal did not publish history");
	return { revision, componentRevision: revision, componentId };
}

/** @alpha @remarks Restores a historical state as a new mutation, with exact current child preconditions. */
export async function restoreSoftwareComponent(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	kind: SoftwareComponentKind,
	componentId: string,
	expectedComponentRevision: number,
	historicalRevision: number,
) {
	componentKey(kind, componentId);
	revisionNumber.parse(historicalRevision);
	await requireRelease(tx, reference, actor);
	const t = softwareComponentRevision;
	const [previous] = await tx
		.select()
		.from(t)
		.where(
			and(
				eq(t.releaseId, reference.id),
				eq(t.kind, kind),
				eq(t.componentId, componentId),
				eq(t.revision, historicalRevision),
			),
		)
		.limit(1);
	if (!previous) throw new Error("Software occurrence history is missing");
	if (previous.operation === "remove")
		return withdrawSoftwareComponent(
			tx,
			reference,
			actor,
			expectedRevision,
			kind,
			componentId,
			expectedComponentRevision,
		);
	const decoded = decodeSoftwareComponentSnapshot(kind, previous.value);
	return putSoftwareComponent(
		tx,
		reference,
		actor,
		expectedRevision,
		componentId,
		expectedComponentRevision,
		decoded,
	);
}
