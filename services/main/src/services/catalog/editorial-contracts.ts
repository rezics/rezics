import { PortableTextDocument } from "@rezics/block";
import { t } from "elysia";
import type { StaticDecode } from "typebox";
import { AvatarInput, ContentLanguageTag, Uuid } from "../api/schema";
import { AvatarResponse, ImageAssetResponse } from "../api/schema/response";

const revision = t.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER });
export const CatalogEditorialEdit = t.Object({ expectedRevision: revision,
	expectedEditorialRevision: t.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER - 1 }) }, { additionalProperties: false });
export const CatalogEditorialContent = t.Object({
	summary: t.Nullable(t.String({ maxLength: 500 })), description: t.Nullable(PortableTextDocument),
	avatar: t.Nullable(AvatarInput), bannerAssetId: t.Nullable(Uuid), coverAssetId: t.Nullable(Uuid),
}, { additionalProperties: false });
export type CatalogEditorialContent = StaticDecode<typeof CatalogEditorialContent>;
export const CatalogEditorialWrite = t.Object({ ...CatalogEditorialEdit.properties, content: CatalogEditorialContent }, { additionalProperties: false });
export type CatalogEditorialWrite = StaticDecode<typeof CatalogEditorialWrite>;
export const CatalogEditorialMutation = t.Object({ revision, editorialRevision: revision });
export const CatalogEditorialResponse = t.Object({ language: ContentLanguageTag, revision,
	editorialRevision: t.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
	content: t.Nullable(CatalogEditorialContent),
	avatar: AvatarResponse, banner: ImageAssetResponse, cover: ImageAssetResponse,
}, { additionalProperties: false });
export const CatalogEditorialLanguages = t.Object({ items: t.Array(t.Object({ language: ContentLanguageTag,
	editorialRevision: revision, state: t.UnionEnum(["active", "withdrawn"]) }), { maxItems: 32 }) });
export const CatalogEditorialHistory = t.Object({ items: t.Array(t.Object({ editorialRevision: revision,
	createdAt: t.String({ format: "date-time" }) }), { maxItems: 100 }), nextCursor: t.Nullable(t.String()) });
