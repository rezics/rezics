import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { z } from "zod";
import { parseContentLanguageTag } from "@rezics/content-language";
import { LabelSchema, type TermLabel, type VocabularyBundle } from "@rezics/schema";
import * as tables from "@rezics/schema/postgres/vocabulary";
import { compileVocabularies, makeLabel, verifyBundle, type ArtifactReader } from "../readers/rdf";
import { datatypeDefinitions } from "@rezics/schema/model/datatypes";
import { termId } from "@rezics/schema/identity";
import { digest } from "@rezics/schema/identity";
import { verifyModel } from "@rezics/schema/model";
import { preferredLabel } from "@rezics/schema/registry";

/** @alpha Drizzle database for shared schema import commands. Applications own connections and authorization. */
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
			for (const group of chunks(release.nodes.map((node) => ({ ...node, releaseId: release.id }))))
				await tx.insert(tables.schemaNode).values(group).onConflictDoNothing();
			for (const group of chunks(
				release.statements.map((statement) => ({
					...statement,
					releaseId: release.id,
					predicateIriHash: digest(statement.predicateIri),
				})),
			))
				await tx.insert(tables.schemaStatement).values(group).onConflictDoNothing();
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

/** @alpha Stage a verified compiled model and its exact standard dependencies; adoption is separate. */
export async function installApplicationModel(tx: SchemaTransaction, input: unknown) {
	const model = verifyModel(input);
	const { id, digest: hash } = model;
	for (const datatype of datatypeDefinitions)
		await tx
			.insert(tables.schemaTerm)
			.values({ id: termId(datatype.iri), iri: datatype.iri, iriHash: digest(datatype.iri) })
			.onConflictDoNothing();
	await tx
		.insert(tables.schemaModelRelease)
		.values({ id, digest: hash, ontologyDigest: model.ontologyDigest, body: model })
		.onConflictDoNothing();
	for (const profile of model.profiles) {
		await tx
			.insert(tables.schemaModelProfile)
			.values({ modelId: id, key: profile.key, owner: profile.owner, body: profile })
			.onConflictDoNothing();
		const bindings = [
			...profile.types.map((type) => ({
				termId: type.termId,
				definitionId: type.definitionId,
				releaseId: type.releaseId,
				role: "type" as const,
			})),
			...profile.properties.map((rule) => ({
				termId: rule.predicateId,
				definitionId: rule.definitionId,
				releaseId: rule.releaseId,
				role: "property" as const,
			})),
		];
		for (const rows of chunks(bindings))
			if (rows.length)
				await tx
					.insert(tables.schemaModelBinding)
					.values(rows.map((row) => ({ ...row, modelId: id, profileKey: profile.key })))
					.onConflictDoNothing();
	}
	return model;
}

/** @alpha Model selection requires a locally installed model and an expected head version. */
export async function selectApplicationModel(
	tx: SchemaTransaction,
	modelId: string,
	expectedVersion: number,
) {
	z.uuid().parse(modelId);
	z.number()
		.int()
		.min(0)
		.max(Number.MAX_SAFE_INTEGER - 1)
		.parse(expectedVersion);
	await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('schema-model:rezics',0))`);
	const [model] = await tx
		.select()
		.from(tables.schemaModelRelease)
		.where(eq(tables.schemaModelRelease.id, modelId));
	if (!model) throw new TypeError("Model is not installed");
	const [head] = await tx
		.select()
		.from(tables.schemaModelHead)
		.where(eq(tables.schemaModelHead.key, "rezics"));
	if ((head?.version ?? 0) !== expectedVersion) throw new TypeError("Model selection changed");
	// BEFORE INSERT guards run even for ON CONFLICT DO UPDATE. The locked
	// existence decision must choose the actual insert/update transition.
	const next = { key: "rezics", modelId, version: expectedVersion + 1 };
	if (head)
		await tx
			.update(tables.schemaModelHead)
			.set(next)
			.where(eq(tables.schemaModelHead.key, "rezics"));
	else await tx.insert(tables.schemaModelHead).values(next);
	return expectedVersion + 1;
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
