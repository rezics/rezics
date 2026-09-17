import { and, desc, eq, getTableName, inArray, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { z } from "zod";
import { parseContentLanguageTag } from "@rezics/content-language";
import {
	LabelSchema,
	LogicalReferenceSchema,
	RelationRevisionSchema,
	type ApplicationProfile,
	type LogicalReference,
	type RelationRevision,
	type TermLabel,
	type VocabularyBundle,
} from "./contracts";
import * as tables from "./drizzle";
import { compileVocabularies, makeLabel, verifyBundle, type ArtifactReader } from "./importer";
import { digest, stableJson } from "./identity";
import { createProfile } from "./profiles";
import { preferredLabel } from "./registry";

/** @alpha Drizzle database for the standalone schema package. Applications own connections and authorization. */
export type SchemaDatabase = NodePgDatabase;
/** @alpha Commands share the caller's transaction, including endpoint validation and domain changes. */
export type SchemaTransaction = Parameters<Parameters<SchemaDatabase["transaction"]>[0]>[0];

/** @alpha Bind exported Drizzle tables to a caller-owned PostgreSQL pool. */
export function createSchemaDatabase(pool: Pool): SchemaDatabase {
	return drizzle({ client: pool });
}

function chunks<T>(rows: T[]): T[][] {
	const result: T[][] = [];
	for (let offset = 0; offset < rows.length; offset += 300)
		result.push(rows.slice(offset, offset + 300));
	return result;
}

/**
 * @alpha Verify then atomically stage a complete bundle; importing never implicitly changes selected releases.
 * @remarks Vocabulary metadata is bounded control-plane data. Caller must authorize maintenance writes.
 */
export async function importVocabularyBundle(
	db: SchemaDatabase,
	input: unknown,
	read: ArtifactReader,
): Promise<VocabularyBundle> {
	const bundle = await verifyBundle(input, read);
	const sources = new Map<string, Buffer>();
	for (const release of bundle.releases) {
		sources.set(release.source.file, Buffer.from(await read(release.source.file)));
		for (const context of release.source.contexts)
			sources.set(context.file, Buffer.from(await read(context.file)));
	}
	await db.transaction(async (tx) => {
		for (const group of chunks(
			bundle.releases.map((release) => ({ id: release.vocabularyId, key: release.source.key })),
		))
			await tx.insert(tables.schemaVocabulary).values(group).onConflictDoNothing();
		for (const group of chunks(
			bundle.terms.map((term) => ({ id: term.id, iri: term.iri, iriHash: digest(term.iri) })),
		)) {
			const aliases = await tx
				.select()
				.from(tables.schemaTermAlias)
				.where(
					inArray(
						tables.schemaTermAlias.iriHash,
						group.map((term) => term.iriHash),
					),
				);
			if (
				aliases.some((alias) =>
					group.some((term) => term.iriHash === alias.iriHash && term.id !== alias.termId),
				)
			)
				throw new TypeError("A canonical IRI cannot take over an existing alias identity");
			await tx.insert(tables.schemaTerm).values(group).onConflictDoNothing();
			const stored = await tx
				.select()
				.from(tables.schemaTerm)
				.where(
					inArray(
						tables.schemaTerm.id,
						group.map((term) => term.id),
					),
				);
			if (
				stored.length !== group.length ||
				stored.some(
					(term) =>
						!group.some(
							(candidate) =>
								candidate.id === term.id &&
								candidate.iri === term.iri &&
								candidate.iriHash === term.iriHash,
						),
				)
			)
				throw new TypeError("Stored term identity conflicts with the imported IRI");
		}
		for (const group of chunks(
			bundle.terms.flatMap((term) =>
				term.aliases.map((iri) => ({ iri, iriHash: digest(iri), termId: term.id })),
			),
		)) {
			const canonical = await tx
				.select()
				.from(tables.schemaTerm)
				.where(
					inArray(
						tables.schemaTerm.iriHash,
						group.map((alias) => alias.iriHash),
					),
				);
			if (
				canonical.some((term) =>
					group.some((alias) => alias.iriHash === term.iriHash && alias.termId !== term.id),
				)
			)
				throw new TypeError("An alias cannot take over an existing term identity");
			await tx.insert(tables.schemaTermAlias).values(group).onConflictDoNothing();
			const stored = await tx
				.select()
				.from(tables.schemaTermAlias)
				.where(
					inArray(
						tables.schemaTermAlias.iriHash,
						group.map((alias) => alias.iriHash),
					),
				);
			if (
				stored.length !== group.length ||
				stored.some(
					(alias) =>
						!group.some(
							(candidate) => candidate.iri === alias.iri && candidate.termId === alias.termId,
						),
				)
			)
				throw new TypeError("Stored alias conflicts with the imported identity");
		}
		for (const release of bundle.releases) {
			await tx
				.insert(tables.schemaRelease)
				.values({
					id: release.id,
					vocabularyId: release.vocabularyId,
					version: release.source.version,
					digest: release.digest,
					source: release.source,
					sourceBytes: sources.get(release.source.file)!,
					canonical: release.canonical,
				})
				.onConflictDoNothing();
			for (const context of release.source.contexts)
				await tx
					.insert(tables.schemaReleaseContext)
					.values({
						releaseId: release.id,
						sha256: context.sha256,
						bytes: sources.get(context.file)!,
					})
					.onConflictDoNothing();
			for (const group of chunks(release.definitions))
				await tx.insert(tables.schemaDefinition).values(group).onConflictDoNothing();
			for (const group of chunks(
				release.definitions.map((definition) => ({
					releaseId: release.id,
					vocabularyId: release.vocabularyId,
					termId: definition.termId,
					definitionId: definition.id,
				})),
			))
				await tx.insert(tables.schemaReleaseTerm).values(group).onConflictDoNothing();
			for (const group of chunks(release.labels))
				await tx.insert(tables.schemaLabel).values(group).onConflictDoNothing();
			for (const group of chunks(
				release.labels.map((label) => ({
					releaseId: release.id,
					termId: label.termId,
					labelId: label.id,
				})),
			))
				await tx.insert(tables.schemaReleaseLabel).values(group).onConflictDoNothing();
		}
	});
	return bundle;
}

/** @alpha Select a release using compare-and-swap; existing relation definitions remain pinned. */
export async function selectVocabularyRelease(
	tx: SchemaTransaction,
	releaseId: string,
	expectedVersion: number,
): Promise<number> {
	z.uuid().parse(releaseId);
	z.number()
		.int()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER - 1)
		.parse(expectedVersion);
	const [release] = await tx
		.select()
		.from(tables.schemaRelease)
		.where(eq(tables.schemaRelease.id, releaseId));
	if (!release) throw new TypeError("Vocabulary release is missing");
	await tx
		.select()
		.from(tables.schemaVocabulary)
		.where(eq(tables.schemaVocabulary.id, release.vocabularyId))
		.for("update");
	const [head] = await tx
		.select()
		.from(tables.schemaVocabularyHead)
		.where(eq(tables.schemaVocabularyHead.vocabularyId, release.vocabularyId));
	if ((head?.version ?? 0) !== expectedVersion) throw new TypeError("Vocabulary selection changed");
	const next = { vocabularyId: release.vocabularyId, releaseId, version: expectedVersion + 1 };
	await tx
		.insert(tables.schemaVocabularyHead)
		.values(next)
		.onConflictDoUpdate({ target: tables.schemaVocabularyHead.vocabularyId, set: next });
	return next.version;
}

/** @alpha Recover the portable representation entirely from retained database artifacts. */
export async function exportVocabularyBundle(
	db: SchemaDatabase,
	releaseIds?: string[],
): Promise<{ bundle: VocabularyBundle; artifacts: Map<string, Uint8Array> }> {
	const ids =
		releaseIds ??
		(await db.select().from(tables.schemaVocabularyHead)).map((head) => head.releaseId);
	if (ids.length === 0 || ids.length > 128 || new Set(ids).size !== ids.length)
		throw new RangeError("Export requires 1..128 distinct releases");
	const releases = await db
		.select()
		.from(tables.schemaRelease)
		.where(inArray(tables.schemaRelease.id, ids));
	if (releases.length !== ids.length) throw new TypeError("Export release is missing");
	const contexts = await db
		.select()
		.from(tables.schemaReleaseContext)
		.where(inArray(tables.schemaReleaseContext.releaseId, ids));
	const artifacts = new Map<string, Uint8Array>();
	const put = (file: string, bytes: Uint8Array) => {
		if (artifacts.has(file) && digest(artifacts.get(file)!) !== digest(bytes))
			throw new TypeError("Export artifact path conflict");
		artifacts.set(file, bytes);
	};
	for (const release of releases) {
		put(release.source.file, release.sourceBytes);
		for (const context of release.source.contexts) {
			const stored = contexts.find(
				(candidate) => candidate.releaseId === release.id && candidate.sha256 === context.sha256,
			);
			if (!stored) throw new TypeError("Captured context is missing");
			put(context.file, stored.bytes);
		}
	}
	const bundle = await compileVocabularies(
		{ format: 1, sources: releases.map((release) => release.source) },
		async (file) => {
			const value = artifacts.get(file);
			if (!value) throw new TypeError("Export artifact is missing");
			return value;
		},
	);
	return { bundle, artifacts };
}

/** @alpha Store an immutable common edit; retrying an ID with different content is rejected. */
export async function putChange(
	tx: SchemaTransaction,
	input: { id: string; actor: { owner: string; id: string } | null; message: string },
): Promise<void> {
	z.uuid().parse(input.id);
	if (input.actor) LogicalReferenceSchema.parse(input.actor);
	if (!input.message || Buffer.byteLength(input.message) > 16_384)
		throw new TypeError("Invalid edit message");
	await tx.insert(tables.schemaChange).values(input).onConflictDoNothing();
	const [stored] = await tx
		.select()
		.from(tables.schemaChange)
		.where(eq(tables.schemaChange.id, input.id));
	if (
		!stored ||
		stored.message !== input.message ||
		stableJson(stored.actor) !== stableJson(input.actor)
	)
		throw new TypeError("Edit ID reused with different content");
}

/** @alpha Pin product constraints without changing upstream term meanings. */
export async function installProfile(
	tx: SchemaTransaction,
	input: ApplicationProfile,
): Promise<void> {
	const profile = createProfile({
		key: input.key,
		types: input.types,
		rules: input.rules,
		additionalProperties: input.additionalProperties,
	});
	if (stableJson(profile) !== stableJson(input))
		throw new TypeError("Profile content identity mismatch");
	const terms = await tx
		.select({ id: tables.schemaTerm.id })
		.from(tables.schemaTerm)
		.where(inArray(tables.schemaTerm.id, profile.types));
	if (new Set(terms.map((term) => term.id)).size !== new Set(profile.types).size)
		throw new TypeError("Profile type is missing");
	await tx
		.insert(tables.schemaProfile)
		.values({ id: profile.id, key: profile.key })
		.onConflictDoNothing();
	await tx
		.insert(tables.schemaProfileRevision)
		.values({
			id: profile.revisionId,
			profileId: profile.id,
			digest: profile.digest,
			body: profile,
		})
		.onConflictDoNothing();
	for (const group of chunks(
		profile.rules.map((rule) => ({
			profileRevisionId: profile.revisionId,
			predicateId: rule.predicateId,
			definitionId: rule.definitionId,
		})),
	))
		await tx.insert(tables.schemaProfileRule).values(group).onConflictDoNothing();
}

/** @alpha Adopt a translation with independent history and per-locale optimistic concurrency. */
export async function selectTermLabel(
	tx: SchemaTransaction,
	input: {
		id: string;
		label: Omit<TermLabel, "id">;
		expectedVersion: number;
		changeId: string;
	},
): Promise<number> {
	z.uuid().parse(input.id);
	z.uuid().parse(input.changeId);
	z.number()
		.int()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER - 1)
		.parse(input.expectedVersion);
	const label = LabelSchema.parse(
		makeLabel({
			...input.label,
			language: input.label.language ? parseContentLanguageTag(input.label.language).tag : "",
		}),
	);
	const [term] = await tx
		.select()
		.from(tables.schemaTerm)
		.where(eq(tables.schemaTerm.id, label.termId))
		.for("update");
	if (!term) throw new TypeError("Label term is missing");
	const [retry] = await tx
		.select()
		.from(tables.schemaLabelSelection)
		.where(eq(tables.schemaLabelSelection.id, input.id));
	if (retry) {
		if (
			retry.labelId !== label.id ||
			retry.changeId !== input.changeId ||
			retry.version !== input.expectedVersion + 1
		)
			throw new TypeError("Label selection ID reused with different content");
		return retry.version;
	}
	const [latest] = await tx
		.select()
		.from(tables.schemaLabelSelection)
		.where(
			and(
				eq(tables.schemaLabelSelection.termId, label.termId),
				eq(tables.schemaLabelSelection.language, label.language),
			),
		)
		.orderBy(desc(tables.schemaLabelSelection.version))
		.limit(1);
	if ((latest?.version ?? 0) !== input.expectedVersion)
		throw new TypeError("Label selection changed");
	await tx.insert(tables.schemaLabel).values(label).onConflictDoNothing();
	await tx.insert(tables.schemaLabelSelection).values({
		id: input.id,
		termId: label.termId,
		language: label.language,
		labelId: label.id,
		version: input.expectedVersion + 1,
		changeId: input.changeId,
	});
	return input.expectedVersion + 1;
}

/** @alpha Hydrate backend-owned labels in one bounded batch, using adopted translations and selected releases. */
export async function readTermLabels(db: SchemaDatabase, ids: string[], language: string) {
	const termIds = [...new Set(z.array(z.uuid()).min(1).max(100).parse(ids))];
	const tag = parseContentLanguageTag(language).tag,
		languages = [...new Set([tag.toLowerCase(), tag.split("-")[0]!.toLowerCase(), "en", ""])];
	const terms = await db
		.select({ id: tables.schemaTerm.id })
		.from(tables.schemaTerm)
		.where(inArray(tables.schemaTerm.id, termIds));
	if (terms.length !== termIds.length) throw new TypeError("Label term is missing");
	const local = await db
		.selectDistinctOn([tables.schemaLabelSelection.termId, tables.schemaLabelSelection.language], {
			label: tables.schemaLabel,
		})
		.from(tables.schemaLabelSelection)
		.innerJoin(tables.schemaLabel, eq(tables.schemaLabelSelection.labelId, tables.schemaLabel.id))
		.where(
			and(
				inArray(tables.schemaLabelSelection.termId, termIds),
				inArray(sql`lower(${tables.schemaLabelSelection.language})`, languages),
			),
		)
		.orderBy(
			tables.schemaLabelSelection.termId,
			tables.schemaLabelSelection.language,
			desc(tables.schemaLabelSelection.version),
		);
	const upstream = await db
		.select({ label: tables.schemaLabel })
		.from(tables.schemaReleaseLabel)
		.innerJoin(
			tables.schemaVocabularyHead,
			eq(tables.schemaReleaseLabel.releaseId, tables.schemaVocabularyHead.releaseId),
		)
		.innerJoin(tables.schemaLabel, eq(tables.schemaReleaseLabel.labelId, tables.schemaLabel.id))
		.where(
			and(
				inArray(tables.schemaReleaseLabel.termId, termIds),
				inArray(sql`lower(${tables.schemaLabel.language})`, languages),
			),
		)
		.limit(10_001);
	if (upstream.length > 10_000) throw new RangeError("Label hydration budget exceeded");
	return termIds.map((termId) => {
		const overrides = local.filter((row) => row.label.termId === termId).map((row) => row.label);
		const locales = new Set(overrides.map((label) => label.language.toLowerCase()));
		const labels = [
			...overrides,
			...upstream
				.filter(
					(row) => row.label.termId === termId && !locales.has(row.label.language.toLowerCase()),
				)
				.map((row) => row.label),
		];
		return { termId, label: preferredLabel(labels, tag) };
	});
}

/** @alpha Endpoint validation is supplied by the owning service and executes inside the same transaction. */
export type ReferenceValidator = (
	reference: LogicalReference,
	tx: SchemaTransaction,
) => Promise<void>;
/** @alpha Select another physical family without changing logical records or command semantics. */
export type RelationTables = ReturnType<typeof tables.defineRelationTables>;
const defaultFamily: RelationTables = {
	relation: tables.schemaRelation,
	revision: tables.schemaRelationRevision,
	selection: tables.schemaRelationSelection,
};

/** @alpha Include these guards in migrations for additional relation families after installing package migrations. */
export function relationIntegritySql(family: RelationTables): string {
	const names = [family.relation, family.revision, family.selection].map(getTableName);
	if (names.some((name) => !/^[a-z][a-z0-9_]{0,62}$/u.test(name)))
		throw new TypeError("Invalid relation family name");
	return (
		names
			.map(
				(name) =>
					`CREATE OR REPLACE TRIGGER schema_immutable BEFORE UPDATE OR DELETE ON public."${name}" FOR EACH ROW EXECUTE FUNCTION public.schema_reject_mutation();`,
			)
			.join("\n") +
		`\nCREATE OR REPLACE TRIGGER schema_revision_parent BEFORE INSERT ON public."${names[1]}" FOR EACH ROW EXECUTE FUNCTION public.schema_require_prior_revision();\n`
	);
}

/** @alpha Append an addressable assertion; creating a proposal does not adopt it as current truth. */
export async function putRelationRevision(
	tx: SchemaTransaction,
	raw: RelationRevision,
	validateReference: ReferenceValidator,
	family: RelationTables = defaultFamily,
): Promise<void> {
	const input = RelationRevisionSchema.parse(raw),
		hash = digest(stableJson(input));
	await validateReference(input.subject, tx);
	if (input.value.kind === "reference") await validateReference(input.value.reference, tx);
	await tx
		.insert(family.relation)
		.values({
			id: input.relationId,
			subjectOwner: input.subject.owner,
			subjectId: input.subject.id,
		})
		.onConflictDoNothing();
	const [relation] = await tx
		.select()
		.from(family.relation)
		.where(eq(family.relation.id, input.relationId));
	if (
		!relation ||
		relation.subjectOwner !== input.subject.owner ||
		relation.subjectId !== input.subject.id
	)
		throw new TypeError("Relation identity belongs to another subject");
	await tx
		.insert(family.revision)
		.values({
			id: input.id,
			relationId: input.relationId,
			predicateId: input.predicateId,
			definitionId: input.definitionId,
			subjectRevisionId: input.subject.revisionId ?? null,
			parentRevisionId: input.parentRevisionId,
			changeId: input.changeId,
			value: input.value,
			position: input.position,
			digest: hash,
		})
		.onConflictDoNothing();
	const [stored] = await tx.select().from(family.revision).where(eq(family.revision.id, input.id));
	if (!stored || stored.digest !== hash)
		throw new TypeError("Relation revision ID reused with different content");
}

/** @alpha Select or retract an exact assertion revision while retaining conflicting proposals and prior decisions. */
export async function selectRelationRevision(
	tx: SchemaTransaction,
	input: {
		id: string;
		relationId: string;
		revisionId: string | null;
		expectedVersion: number;
		changeId: string;
	},
	family: RelationTables = defaultFamily,
): Promise<number> {
	z.uuid().parse(input.id);
	z.uuid().parse(input.relationId);
	z.uuid().nullable().parse(input.revisionId);
	z.uuid().parse(input.changeId);
	z.number()
		.int()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER - 1)
		.parse(input.expectedVersion);
	const [relation] = await tx
		.select()
		.from(family.relation)
		.where(eq(family.relation.id, input.relationId))
		.for("update");
	if (!relation) throw new TypeError("Relation is missing");
	const [retry] = await tx.select().from(family.selection).where(eq(family.selection.id, input.id));
	if (retry) {
		if (
			retry.relationId !== input.relationId ||
			retry.revisionId !== input.revisionId ||
			retry.changeId !== input.changeId ||
			retry.version !== input.expectedVersion + 1
		)
			throw new TypeError("Selection ID reused with different content");
		return retry.version;
	}
	const [latest] = await tx
		.select()
		.from(family.selection)
		.where(eq(family.selection.relationId, input.relationId))
		.orderBy(desc(family.selection.version))
		.limit(1);
	if ((latest?.version ?? 0) !== input.expectedVersion)
		throw new TypeError("Relation selection changed");
	await tx.insert(family.selection).values({
		id: input.id,
		relationId: input.relationId,
		revisionId: input.revisionId,
		changeId: input.changeId,
		version: input.expectedVersion + 1,
	});
	return input.expectedVersion + 1;
}
