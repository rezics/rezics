import { parseContentLanguageTag } from "@rezics/content-language";
import { AvatarTypeValues, FontAwesomeIconPrefixValues } from "@rezics/avatar";
import { and, desc, eq, lt } from "drizzle-orm";
import { createSchemaFactory } from "drizzle-orm/zod";
import { Value } from "typebox/value";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogEditorialTables } from "../database/schema/catalog-editorial";
import { ensureImageAssetsAttachable } from "../api/image-assets/service";
import { presentImageAsset } from "../api/image-assets/presentation";
import { avatarReferenceFromColumns, avatarReferenceToColumns, unitLocalizationImageAssetReferences } from "../units/localization";
import { presentAvatar } from "../units/avatar";
import { CatalogEditorialContent, CatalogEditorialWrite } from "./editorial-contracts";
import type { CatalogReference } from "./contracts";
import { CatalogReferenceNotFound, CatalogRevisionConflict, loadCatalogIdentity, recordCatalogChange } from "./storage";
import { decodeDomainCursor, encodeDomainCursor } from "./domain-api-pagination";

const snapshotSchema = createSchemaFactory({ coerce: { date: true } }).createSelectSchema(CatalogEditorialTables.entity.current, {
	avatarType: z.enum(AvatarTypeValues).nullable(), avatarIconPrefix: z.enum(FontAwesomeIconPrefixValues).nullable(),
	state: z.enum(["active", "withdrawn"]),
});
type EditorialRow = z.output<typeof snapshotSchema>;
function content(row: EditorialRow) {
	return Value.Decode(CatalogEditorialContent, { summary: row.summary, description: row.description,
		avatar: avatarReferenceFromColumns(row), bannerAssetId: row.bannerAssetId, coverAssetId: row.coverAssetId });
}
function present(row: EditorialRow | undefined, language: string, revision: number) {
	const value = row?.state === "active" ? content(row) : null;
	return { language, revision, editorialRevision: row?.revision ?? 0, content: value,
		avatar: presentAvatar(value?.avatar ?? null), banner: presentImageAsset(value?.bannerAssetId ?? null,"banner"),
		cover: presentImageAsset(value?.coverAssetId ?? null,"cover") };
}

/** @alpha @remarks Exact-language editorial reads enforce the current native owner's visibility and rating. */
export async function readCatalogEditorial(tx: DatabaseTransaction, ref: CatalogReference, actor: string | null, languageInput: string) {
	const language = parseContentLanguageTag(languageInput).tag;
	const identity = await loadCatalogIdentity(tx, ref, actor, false);
	const table = CatalogEditorialTables[ref.owner].current;
	const [row] = await tx.select().from(table).where(and(eq(table.ownerId,ref.id),eq(table.language,language))).limit(1);
	return present(row ? snapshotSchema.parse(row) : undefined,language,identity.revision);
}
export async function listCatalogEditorialLanguages(tx: DatabaseTransaction, ref: CatalogReference, actor: string | null) {
	await loadCatalogIdentity(tx, ref, actor, false);
	const table = CatalogEditorialTables[ref.owner].current;
	return { items: await tx.select({ language: table.language, editorialRevision: table.revision, state: table.state })
		.from(table).where(eq(table.ownerId,ref.id)).orderBy(table.language).limit(32) };
}

/** @alpha @remarks Owner and language revisions must both match; each accepted edit appends an immutable snapshot. */
export async function writeCatalogEditorial(tx: DatabaseTransaction, ref: CatalogReference, actor: string, languageInput: string,
	input: CatalogEditorialWrite, state: "active" | "withdrawn" = "active") {
	const value = Value.Decode(CatalogEditorialWrite,input);
	if (Buffer.byteLength(JSON.stringify(value.content)) > 512_000) throw new RangeError("Editorial content exceeds its document budget");
	const language = parseContentLanguageTag(languageInput).tag;
	const identity = await loadCatalogIdentity(tx, ref, actor, true);
	if (identity.revision !== value.expectedRevision) throw new CatalogRevisionConflict();
	const table = CatalogEditorialTables[ref.owner].current;
	const [row] = await tx.select().from(table).where(and(eq(table.ownerId,ref.id),eq(table.language,language))).limit(1);
	if ((row?.revision ?? 0) !== value.expectedEditorialRevision) throw new CatalogRevisionConflict("Editorial language changed");
	if (!row) {
		const languages = await tx.select({ language: table.language }).from(table).where(eq(table.ownerId,ref.id)).limit(32);
		if (languages.length >= 32) throw new RangeError("Editorial language capacity exceeded");
	}
	const existingAssets = row ? new Map(unitLocalizationImageAssetReferences(content(snapshotSchema.parse(row))).map(item=>[item.role,item.assetId])) : new Map();
	await ensureImageAssetsAttachable(tx,actor,unitLocalizationImageAssetReferences(value.content)
		.filter(item=>item.assetId && existingAssets.get(item.role)!==item.assetId));
	const revision = await recordCatalogChange(tx,ref,actor,value.expectedRevision,`editorial.${state}`);
	const editorialRevision = (row?.revision ?? 0) + 1;
	const columns = { state, summary: value.content.summary, description: value.content.description,
		...avatarReferenceToColumns(value.content.avatar), bannerAssetId: value.content.bannerAssetId,
		coverAssetId: value.content.coverAssetId, revision: editorialRevision, operatorAuthUserId: actor, updatedAt: new Date() };
	if (row) await tx.update(table).set(columns).where(and(eq(table.ownerId,ref.id),eq(table.language,language)));
	else await tx.insert(table).values({ ownerId: ref.id,language,...columns });
	return { revision,editorialRevision };
}
export async function listCatalogEditorialHistory(tx: DatabaseTransaction, ref: CatalogReference, actor: string, languageInput: string,
	query: { cursor?: string; limit: number }) {
	await loadCatalogIdentity(tx,ref,actor,true,"share");
	const language=parseContentLanguageTag(languageInput).tag, scope=`editorial:${ref.owner}:${ref.id}:${language}`;
	const after=decodeDomainCursor(scope,query.cursor,z.number().int().positive().safe());
	const table=CatalogEditorialTables[ref.owner].history;
	const rows=await tx.select({ editorialRevision: table.revision,createdAt: table.createdAt }).from(table)
		.where(and(eq(table.ownerId,ref.id),eq(table.language,language),after ? lt(table.revision,after) : undefined))
		.orderBy(desc(table.revision)).limit(query.limit+1);
	const items=rows.slice(0,query.limit).map(row=>({...row,createdAt:row.createdAt.toISOString()}));
	return {items,nextCursor:rows.length>query.limit ? encodeDomainCursor(scope,items.at(-1)?.editorialRevision) : null};
}
export async function readCatalogEditorialRevision(tx: DatabaseTransaction, ref: CatalogReference, actor: string, languageInput: string, editorialRevision: number) {
	const identity=await loadCatalogIdentity(tx,ref,actor,true,"share");
	const language=parseContentLanguageTag(languageInput).tag;
	const table=CatalogEditorialTables[ref.owner].history;
	const [row]=await tx.select({snapshot:table.snapshot}).from(table).where(and(eq(table.ownerId,ref.id),eq(table.language,language),eq(table.revision,editorialRevision))).limit(1);
	if (!row) throw new CatalogReferenceNotFound("Editorial revision is unavailable");
	const raw=z.record(z.string(),z.unknown()).parse(row.snapshot);
	const parsed=snapshotSchema.parse(Object.fromEntries(Object.entries(raw).map(([key,value])=>[key.replace(/_([a-z])/gu,(_,letter:string)=>letter.toUpperCase()),value])));
	if(parsed.ownerId!==ref.id||parsed.language!==language||parsed.revision!==editorialRevision) throw new Error("Editorial snapshot identity mismatch");
	return present(parsed,language,identity.revision);
}
