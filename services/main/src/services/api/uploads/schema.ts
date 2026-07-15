import { type Static, t } from "elysia";

export const RequestUploadBody = t.Object({
	filename: t.String({ minLength: 1, maxLength: 255 }),
	contentType: t.String({ minLength: 1, maxLength: 100 }),
	size: t.Integer({ minimum: 1, maximum: 10_485_760 }),
});
export type RequestUploadBody = Static<typeof RequestUploadBody>;

export const UploadKeyBody = t.Object({ key: t.String({ minLength: 1, maxLength: 1_000 }) });
export type UploadKeyBody = Static<typeof UploadKeyBody>;

export const UploadUrlQuery = t.Object({ key: t.String({ minLength: 1, maxLength: 1_000 }) });
export type UploadUrlQuery = Static<typeof UploadUrlQuery>;
