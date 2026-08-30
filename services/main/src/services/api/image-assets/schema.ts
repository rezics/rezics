import type { StaticDecode } from "typebox";
import { t } from "elysia";

import {
	ImageAssetPresentationRoleValues,
	ImageAssetStatusValues,
} from "../../database/schema/contract-values";
import { Uuid } from "../schema";

export const ImageAssetAccess = t.Union([t.Literal("private"), t.Literal("public")]);
export type ImageAssetAccess = StaticDecode<typeof ImageAssetAccess>;

export const CreateImageAssetBody = t.Object(
	{
		contentType: t.String({ minLength: 1, maxLength: 100 }),
		size: t.Integer({ minimum: 1, maximum: 10_485_760 }),
		access: t.Optional(ImageAssetAccess),
	},
	{ additionalProperties: false },
);
export type CreateImageAssetBody = StaticDecode<typeof CreateImageAssetBody>;

export const ImageAssetParams = t.Object({ id: Uuid });
export type ImageAssetParams = StaticDecode<typeof ImageAssetParams>;

export const ImageAssetPresentationRole = t.UnionEnum(ImageAssetPresentationRoleValues);
export type ImageAssetPresentationRole = StaticDecode<typeof ImageAssetPresentationRole>;

export const ImageAssetPresentationParams = t.Object({
	id: Uuid,
	role: ImageAssetPresentationRole,
});
export type ImageAssetPresentationParams = StaticDecode<typeof ImageAssetPresentationParams>;

export const ImageAssetCrop = t.Object(
	{
		x: t.Number({ minimum: 0, maximum: 1 }),
		y: t.Number({ minimum: 0, maximum: 1 }),
		width: t.Number({ exclusiveMinimum: 0, maximum: 1 }),
		height: t.Number({ exclusiveMinimum: 0, maximum: 1 }),
	},
	{ additionalProperties: false },
);
export type ImageAssetCrop = StaticDecode<typeof ImageAssetCrop>;

export const UpsertImageAssetPresentationBody = t.Union([
	t.Object({ fit: t.Literal("contain") }, { additionalProperties: false }),
	t.Object({ fit: t.Literal("crop"), crop: ImageAssetCrop }, { additionalProperties: false }),
]);
export type UpsertImageAssetPresentationBody = StaticDecode<
	typeof UpsertImageAssetPresentationBody
>;

export const CompleteImageAssetBody = t.Object(
	{ role: ImageAssetPresentationRole },
	{ additionalProperties: false },
);
export type CompleteImageAssetBody = StaticDecode<typeof CompleteImageAssetBody>;

export const ImageAssetPresentationResponse = t.Object({
	role: ImageAssetPresentationRole,
	fit: t.Union([t.Literal("crop"), t.Literal("contain")]),
	crop: t.Nullable(ImageAssetCrop),
	revision: t.Integer({ minimum: 1 }),
	contentUrl: t.String(),
});

export const ImageAssetResponse = t.Object({
	id: Uuid,
	status: t.UnionEnum(ImageAssetStatusValues),
	access: ImageAssetAccess,
	contentType: t.Nullable(t.String()),
	size: t.Nullable(t.Integer()),
	width: t.Nullable(t.Integer({ minimum: 1 })),
	height: t.Nullable(t.Integer({ minimum: 1 })),
	contentUrl: t.String(),
	presentations: t.Array(ImageAssetPresentationResponse),
	createdAt: t.Date(),
	updatedAt: t.Date(),
});

export const CreateImageAssetResponse = t.Intersect([
	ImageAssetResponse,
	t.Object({
		upload: t.Object({
			url: t.String(),
			expiresIn: t.Integer(),
			headers: t.Record(t.String(), t.String()),
		}),
	}),
]);
