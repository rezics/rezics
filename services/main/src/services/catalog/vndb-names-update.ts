import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { CatalogNameTables } from "../database/schema/catalog-names";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { CatalogSourceOwnedBaselines } from "../database/schema/catalog-source-owned-baseline";
import type { CatalogReference } from "./contracts";
import { CatalogNameValuesSchema, type CatalogNameInput } from "./name-contracts";
import {
	addCatalogName,
	bindCatalogNameSourceOccurrence,
	requireCatalogNameRevision,
	reviseCatalogName,
} from "./names";
import { addCatalogNameAuthority } from "./authority";
import { catalogNameRevisionValues } from "./source-owned-compensation";
import { resolveCatalogSourceOwnedBaseline } from "./source-owned-baselines";
import type { recordCatalogSourceDocument } from "./source-observations";
import type { CatalogSourceNativeChange } from "./source-applications";
import { CatalogRevisionConflict } from "./storage";
import { VndbVnSchema, VndbReleaseSchema, vndbLanguage } from "./vndb";

type Document = Awaited<ReturnType<typeof recordCatalogSourceDocument>>;
type SourceFields = Pick<CatalogNameInput, "value"> &
	Partial<
		Pick<
			CatalogNameInput,
			"languageTag" | "origin" | "primaryForLanguage" | "derivationNameId" | "derivationRevision"
		>
	>;
export type VndbNativeNamePlan = {
	key: string;
	namespace: "vndb.vn.name" | "vndb.release.name";
	path: string;
	fields: SourceFields;
	official?: { value: boolean; path: string };
	derivationKey?: string;
};

/** @internal Stable title/alias source keys; mutable spelling never identifies a person or a software work. */
export function planVndbNativeNames(
	input: unknown,
	family: "vn" | "release",
	path: (value: string) => string = (value) => value,
): VndbNativeNamePlan[] {
	const namespace = family === "vn" ? "vndb.vn.name" : "vndb.release.name";
	const record = family === "vn" ? VndbVnSchema.parse(input) : VndbReleaseSchema.parse(input);
	const plan: VndbNativeNamePlan[] = [
		{ namespace, key: "display", path: path("/title"), fields: { value: record.title } },
	];
	if (family === "vn") {
		const vn = VndbVnSchema.parse(record);
		for (const [index, title] of (vn.titles ?? []).entries()) {
			const language = vndbLanguage(title.lang);
			plan.push({
				namespace,
				key: `title/${language}`,
				path: path(`/titles/${index}/title`),
				fields: {
					value: title.title,
					languageTag: language,
					origin: "original",
					primaryForLanguage: true,
				},
				official: { value: title.official, path: path(`/titles/${index}/official`) },
			});
			if (title.latin)
				plan.push({
					namespace,
					key: `romanization/${language}`,
					derivationKey: `title/${language}`,
					path: path(`/titles/${index}/latin`),
					fields: {
						value: title.latin,
						languageTag: null,
						origin: "transliteration",
						primaryForLanguage: null,
					},
				});
		}
		const seen = new Map<string, number>();
		for (const [index, alias] of (vn.aliases ?? []).entries()) {
			if (!alias) continue;
			const hash = createHash("sha256").update(alias).digest("hex"),
				occurrence = seen.get(hash) ?? 0;
			seen.set(hash, occurrence + 1);
			plan.push({
				namespace,
				key: `alias/${hash}/${occurrence}`,
				path: path(`/aliases/${index}`),
				fields: { value: alias, languageTag: null, origin: "variant", primaryForLanguage: null },
			});
		}
	}
	return plan;
}

function mergeField<T>(before: T | undefined, after: T | undefined, current: T): T {
	if (after === undefined || isDeepStrictEqual(before, after)) return current;
	if (!isDeepStrictEqual(current, before) && !isDeepStrictEqual(current, after))
		throw new CatalogRevisionConflict("VNDB title conflicts with an independent native edit");
	return after;
}
async function sourceName(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	document: Document,
	item: VndbNativeNamePlan,
) {
	const t = CatalogNameTables[ref.owner].sourceOccurrence;
	const [row] = await tx
		.select()
		.from(t)
		.where(
			and(
				eq(t.sourceRecordId, document.record.id),
				eq(t.namespace, item.namespace),
				eq(t.localKey, item.key),
				eq(t.snapshotId, document.snapshot.id),
				eq(t.ownerId, ref.id),
			),
		)
		.limit(1);
	return row;
}
async function supportName(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string,
	document: Document,
	item: VndbNativeNamePlan,
	id: string,
	revision: number,
) {
	const existing = await sourceName(tx, ref, document, item);
	if (existing) {
		if (existing.nameId !== id)
			throw new CatalogRevisionConflict("VNDB snapshot already identifies another named form");
		return { id: existing.nameId, revision: existing.nameRevision };
	}
	await bindCatalogNameSourceOccurrence(tx, ref, actor, {
		sourceRecordId: document.record.id,
		snapshotId: document.snapshot.id,
		namespace: item.namespace,
		localKey: item.key,
		sourcePath: item.path,
		nameId: id,
		nameRevision: revision,
	});
	await tx.insert(CatalogFactTables[ref.owner].support).values({
		ownerId: ref.id,
		namedFormId: id,
		sourceRecordId: document.record.id,
		snapshotId: document.snapshot.id,
		sourcePath: item.path,
	});
	return { id, revision };
}
async function claimAuthority(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string,
	document: Document,
	item: VndbNativeNamePlan,
	name: { id: string; revision: number },
) {
	if (!item.official) return null;
	const t = CatalogNameTables[ref.owner].authority;
	const [existing] = await tx
		.select()
		.from(t)
		.where(
			and(
				eq(t.ownerId, ref.id),
				eq(t.nameId, name.id),
				eq(t.nameRevision, name.revision),
				eq(t.sourceRecordId, document.record.id),
				eq(t.snapshotId, document.snapshot.id),
				eq(t.role, "title"),
				eq(t.state, "active"),
			),
		)
		.limit(1);
	if (existing) return null;
	const claim = await addCatalogNameAuthority(tx, ref, actor, {
		nameId: name.id,
		nameRevision: name.revision,
		claim: item.official.value ? "official" : "unofficial",
		reviewState: "source_claim",
		authorizerEntityId: null,
		role: "title",
		territory: null,
		channel: null,
		context: null,
		validFrom: null,
		validUntil: null,
		evidence: {
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			sourcePath: item.official.path,
		},
		reviewEvidence: null,
		state: "active",
	});
	return {
		kind: "catalog-name-authority" as const,
		owner: ref.owner,
		ownerId: ref.id,
		componentKey: claim.id,
		beforeRevision: null,
		afterRevision: claim.revision,
	};
}

/** @internal Applies only changed source fields, retaining unrelated native named-form metadata. */
export async function reconcileVndbNativeNames(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string,
	expectedRevision: number,
	mappingKey: string,
	before: { plan: VndbNativeNamePlan[]; document: Document },
	after: { plan: VndbNativeNamePlan[]; document: Document },
) {
	const old = new Map(before.plan.map((item) => [item.key, item]));
	const next = new Map(after.plan.map((item) => [item.key, item]));
	if (old.size !== before.plan.length || next.size !== after.plan.length)
		throw new TypeError("Duplicate VNDB title source key");
	const changes: CatalogSourceNativeChange[] = [];
	let revision = expectedRevision;
	const acceptedNames = new Map<string, { id: string; revision: number }>();
	for (const rawItem of after.plan) {
		const derivation = rawItem.derivationKey ? acceptedNames.get(rawItem.derivationKey) : undefined;
		if (rawItem.derivationKey && !derivation)
			throw new Error("VNDB transliteration has no exact original name");
		const item = derivation
			? {
					...rawItem,
					fields: {
						...rawItem.fields,
						derivationNameId: derivation.id,
						derivationRevision: derivation.revision,
					},
				}
			: rawItem;
		let previous = old.get(item.key);
		if (previous?.derivationKey) {
			const originalPlan = old.get(previous.derivationKey);
			const original = originalPlan
				? await sourceName(tx, ref, before.document, originalPlan)
				: undefined;
			if (!original) throw new Error("Previous transliteration lacks its source original");
			previous = {
				...previous,
				fields: {
					...previous.fields,
					derivationNameId: original.nameId,
					derivationRevision: original.nameRevision,
				},
			};
		}
		const origin = previous ? await sourceName(tx, ref, before.document, previous) : undefined;
		if (previous && !origin) throw new Error("VNDB title has no exact previous source occurrence");
		const t = CatalogNameTables[ref.owner];
		const [binding] = await tx
			.select()
			.from(t.sourceBinding)
			.where(
				and(
					eq(t.sourceBinding.sourceRecordId, after.document.record.id),
					eq(t.sourceBinding.namespace, item.namespace),
					eq(t.sourceBinding.localKey, item.key),
					eq(t.sourceBinding.ownerId, ref.id),
				),
			)
			.limit(1);
		let adopted: { id: string; revision: number };
		if (!binding) {
			const created = await addCatalogName(tx, ref, actor, revision, {
				kind:
					item.key === "display"
						? "source-display"
						: item.fields.origin === "original"
							? "source-title"
							: item.fields.origin === "transliteration"
								? "source-transliteration"
								: "source-alias",
				languageTag: null,
				...item.fields,
			});
			revision = created.revision;
			adopted = { id: created.id, revision: created.nameRevision };
			changes.push({
				kind: "catalog-name",
				owner: ref.owner,
				ownerId: ref.id,
				componentKey: created.id,
				beforeRevision: null,
				afterRevision: created.nameRevision,
			});
		} else {
			const [current] = await tx
				.select()
				.from(t.name)
				.where(and(eq(t.name.ownerId, ref.id), eq(t.name.id, binding.nameId)))
				.limit(1);
			if (!current) throw new Error("VNDB named-form binding lost its native target");
			if (origin && previous && isDeepStrictEqual(previous.fields, item.fields))
				adopted = { id: origin.nameId, revision: origin.nameRevision };
			else {
				const baseline = CatalogSourceOwnedBaselines[ref.owner];
				if (!origin) {
					const [known] = await tx
						.select()
						.from(baseline)
						.where(
							and(
								eq(baseline.sourceRecordId, after.document.record.id),
								eq(baseline.mappingKey, mappingKey),
								eq(baseline.ownerId, ref.id),
								eq(baseline.kind, "catalog-name"),
								eq(baseline.componentKey, current.id),
							),
						)
						.limit(1);
					if (!known || known.currentRevision !== current.revision || !known.absent)
						throw new CatalogRevisionConflict(
							"VNDB title reappearance would replace independently owned metadata",
						);
				}
				if (origin && current.state !== "active")
					throw new CatalogRevisionConflict("VNDB title was independently withdrawn");
				const values = catalogNameRevisionValues(current);
				if (previous) {
					values.value = mergeField(previous.fields.value, item.fields.value, current.value);
					values.languageTag = mergeField(
						previous.fields.languageTag,
						item.fields.languageTag,
						current.languageTag,
					);
					values.origin = mergeField(previous.fields.origin, item.fields.origin, current.origin);
					values.primaryForLanguage = mergeField(
						previous.fields.primaryForLanguage,
						item.fields.primaryForLanguage,
						current.primaryForLanguage,
					);
					values.derivationNameId = mergeField(
						previous.fields.derivationNameId,
						item.fields.derivationNameId,
						current.derivationNameId,
					);
					values.derivationRevision = mergeField(
						previous.fields.derivationRevision,
						item.fields.derivationRevision,
						current.derivationRevision,
					);
				} else Object.assign(values, item.fields, { state: "active" });
				const updated = await reviseCatalogName(
					tx,
					ref,
					actor,
					current.id,
					current.revision,
					values,
				);
				adopted = { id: updated.id, revision: updated.revision };
				changes.push({
					kind: "catalog-name",
					owner: ref.owner,
					ownerId: ref.id,
					componentKey: updated.id,
					beforeRevision: current.revision,
					afterRevision: updated.revision,
				});
			}
		}
		const accepted = await supportName(
			tx,
			ref,
			actor,
			after.document,
			item,
			adopted.id,
			adopted.revision,
		);
		acceptedNames.set(item.key, accepted);
		if (
			!previous ||
			!origin ||
			!isDeepStrictEqual(previous.official?.value, item.official?.value) ||
			!isDeepStrictEqual(previous.fields, item.fields) ||
			adopted.revision !== origin.nameRevision
		) {
			const authority = await claimAuthority(tx, ref, actor, after.document, item, adopted);
			if (authority) changes.push(authority);
		}
	}
	for (const item of before.plan) {
		if (next.has(item.key)) continue;
		const origin = await sourceName(tx, ref, before.document, item);
		if (!origin) throw new Error("Removed VNDB title has no exact native occurrence");
		const expected = await resolveCatalogSourceOwnedBaseline(
			tx,
			{ sourceRecordId: before.document.record.id, mappingKey },
			{ kind: "catalog-name", owner: ref.owner, ownerId: ref.id, componentKey: origin.nameId },
			origin.nameRevision,
		);
		const current = await requireCatalogNameRevision(tx, ref, actor, origin.nameId, expected);
		const sourceKind =
			item.key === "display" && ["primary", "source-display"].includes(current.kind)
				? current.kind
				: item.fields.origin === "original"
					? "source-title"
					: item.fields.origin === "transliteration"
						? "source-transliteration"
						: "source-alias";
		const originalPlan = item.derivationKey ? old.get(item.derivationKey) : undefined;
		const original = originalPlan
			? await sourceName(tx, ref, before.document, originalPlan)
			: undefined;
		const sourceValues = CatalogNameValuesSchema.parse({
			kind: sourceKind,
			languageTag: null,
			...item.fields,
			...(original
				? { derivationNameId: original.nameId, derivationRevision: original.nameRevision }
				: {}),
		});
		if (
			!isDeepStrictEqual(
				sourceValues,
				CatalogNameValuesSchema.parse(catalogNameRevisionValues(current)),
			)
		)
			throw new CatalogRevisionConflict(
				"Removing VNDB named form would erase independent native metadata",
			);
		const updated = await reviseCatalogName(tx, ref, actor, origin.nameId, expected, {
			...catalogNameRevisionValues(current),
			state: "withdrawn",
		});
		changes.push({
			kind: "catalog-name",
			owner: ref.owner,
			ownerId: ref.id,
			componentKey: origin.nameId,
			beforeRevision: expected,
			afterRevision: updated.revision,
		});
	}
	return { revision, changes };
}

/** @internal Reissued source claims attach only to restored text that still matches the exact previous source. */
export async function restoreVndbNameAuthority(
	tx: DatabaseTransaction,
	ref: CatalogReference,
	actor: string,
	plan: VndbNativeNamePlan[],
	document: Document,
) {
	const changes: CatalogSourceNativeChange[] = [];
	const t = CatalogNameTables[ref.owner];
	for (const item of plan) {
		if (!item.official) continue;
		const [name] = await tx
			.select({
				id: t.name.id,
				revision: t.name.revision,
				state: t.name.state,
				value: t.name.value,
				languageTag: t.name.languageTag,
			})
			.from(t.sourceBinding)
			.innerJoin(
				t.name,
				and(eq(t.name.ownerId, t.sourceBinding.ownerId), eq(t.name.id, t.sourceBinding.nameId)),
			)
			.where(
				and(
					eq(t.sourceBinding.sourceRecordId, document.record.id),
					eq(t.sourceBinding.namespace, item.namespace),
					eq(t.sourceBinding.localKey, item.key),
					eq(t.sourceBinding.ownerId, ref.id),
				),
			)
			.limit(1);
		if (
			!name ||
			name.state !== "active" ||
			name.value !== item.fields.value ||
			(item.fields.languageTag !== undefined && name.languageTag !== item.fields.languageTag)
		)
			continue;
		const change = await claimAuthority(tx, ref, actor, document, item, {
			id: name.id,
			revision: name.revision,
		});
		if (change) changes.push(change);
	}
	return changes;
}
