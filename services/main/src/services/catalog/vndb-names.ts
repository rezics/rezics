import { catalogSourceSupportColumns } from "./source-support";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogReference } from "./contracts";
import { addCatalogName } from "./names";
import { bindCatalogNameSourceOccurrence } from "./names";
import { addCatalogNameAuthority } from "./authority";
import type { recordCatalogSourceDocument } from "./source-observations";
import { VndbVnSchema, vndbLanguage } from "./vndb";

/** @alpha @remarks Native titles retain language, romanization, exact source evidence and scoped officialness claims. */
export async function appendVndbVnNames(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	record: z.output<typeof VndbVnSchema>,
	document: Awaited<ReturnType<typeof recordCatalogSourceDocument>>,
	sourcePath: (path: string) => string = (path) => path,
) {
	let revision = expectedRevision;
	const write = async (
		value: string,
		languageTag: string | null,
		origin: "original" | "transliteration" | "variant",
		key: string,
		path: string,
		primaryForLanguage: boolean | null,
		derivation?: { id: string; revision: number },
	) => {
		const named = await addCatalogName(tx, reference, actor, revision, {
			value,
			languageTag,
			origin,
			kind:
				origin === "original"
					? "source-title"
					: origin === "transliteration"
						? "source-transliteration"
						: "source-alias",
			primaryForLanguage,
			derivationNameId: derivation?.id ?? null,
			derivationRevision: derivation?.revision ?? null,
		});
		revision = named.revision;
		await bindCatalogNameSourceOccurrence(tx, reference, actor, {
			namespace: "vndb.vn.name",
			localKey: key,
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			sourcePath: sourcePath(path),
			nameId: named.id,
			nameRevision: named.nameRevision,
		});
		await tx.insert(CatalogFactTables[reference.owner].support).values({
			...(await catalogSourceSupportColumns(tx, document.record.id)),
			ownerId: reference.id,
			namedFormId: named.id,
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			sourcePath: sourcePath(path),
		});
		return named;
	};
	for (const [index, title] of (record.titles ?? []).entries()) {
		const languageTag = vndbLanguage(title.lang);
		const named = await write(
			title.title,
			languageTag,
			"original",
			`title/${languageTag}`,
			`/titles/${index}/title`,
			true,
		);
		await addCatalogNameAuthority(tx, reference, actor, {
			nameId: named.id,
			nameRevision: named.nameRevision,
			claim: title.official ? "official" : "unofficial",
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
				sourcePath: sourcePath(`/titles/${index}/official`),
			},
			reviewEvidence: null,
			state: "active",
		});
		if (title.latin)
			await write(
				title.latin,
				null,
				"transliteration",
				`romanization/${languageTag}`,
				`/titles/${index}/latin`,
				null,
				{ id: named.id, revision: named.nameRevision },
			);
	}
	const seen = new Map<string, number>();
	for (const [index, alias] of (record.aliases ?? []).entries()) {
		if (!alias) continue;
		const hash = createHash("sha256").update(alias).digest("hex");
		const occurrence = seen.get(hash) ?? 0;
		seen.set(hash, occurrence + 1);
		await write(alias, null, "variant", `alias/${hash}/${occurrence}`, `/aliases/${index}`, null);
	}
	return revision;
}

/** @internal Reuses a freshly created display name while assigning exact immutable source evidence. */
export async function appendVndbDisplayName(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	value: string,
	document: Awaited<ReturnType<typeof recordCatalogSourceDocument>>,
	namespace: "vndb.vn.name" | "vndb.release.name",
	sourcePath: string,
	created?: { id: string; revision: number },
) {
	const named = created
		? { id: created.id, nameRevision: created.revision, revision: expectedRevision }
		: await addCatalogName(tx, reference, actor, expectedRevision, {
				value,
				languageTag: null,
				kind: "source-display",
			});
	await bindCatalogNameSourceOccurrence(tx, reference, actor, {
		namespace,
		localKey: "display",
		sourceRecordId: document.record.id,
		snapshotId: document.snapshot.id,
		sourcePath,
		nameId: named.id,
		nameRevision: named.nameRevision,
	});
	await tx.insert(CatalogFactTables[reference.owner].support).values({
		...(await catalogSourceSupportColumns(tx, document.record.id)),
		ownerId: reference.id,
		namedFormId: named.id,
		sourceRecordId: document.record.id,
		snapshotId: document.snapshot.id,
		sourcePath,
	});
	return named.revision;
}
