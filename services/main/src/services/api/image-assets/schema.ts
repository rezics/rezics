import { type Static, t } from "elysia";

import { Uuid } from "../schema";

export const ImageAssetAccess = t.Union([t.Literal("private"), t.Literal("public")]);
export type ImageAssetAccess = Static<typeof ImageAssetAccess>;

export const CreateImageAssetBody = t.Object(
	{
		contentType: t.String({ minLength: 1, maxLength: 100 }),
		size: t.Integer({ minimum: 1, maximum: 10_485_760 }),
		access: t.Optional(ImageAssetAccess),
	},
	{ additionalProperties: false },
);
export type CreateImageAssetBody = Static<typeof CreateImageAssetBody>;

export const ImageAssetParams = t.Object({ id: Uuid });
export type ImageAssetParams = Static<typeof ImageAssetParams>;

export const ImageAssetResponse = t.Object({
	id: Uuid,
	status: t.Union([t.Literal("pending"), t.Literal("ready"), t.Literal("failed")]),
	access: ImageAssetAccess,
	contentType: t.Nullable(t.String()),
	size: t.Nullable(t.Integer()),
	contentUrl: t.String(),
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
