import { StatusCodes } from "http-status-codes";
import { fileTypeFromBuffer } from "file-type";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import { UploadKeyForbidden } from "../../authorization/errors";
import { isStorageNotFound, storage } from "../../storage";
import { NoContentResponse } from "../schema/action-response";
import {
	toApiErrorResponse,
	UploadCompleteResponse,
	UploadRequestResponse,
	UploadUrlResponse,
} from "../schema/response";
import { RequestUploadBody, UploadKeyBody, UploadUrlQuery } from "./schema";
import {
	UploadContentMismatch,
	UploadInvalidSize,
	UploadNotFound,
	UploadUnsupportedType,
} from "./errors";

const allowedTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);

const AuthenticationRequiredResponse = toApiErrorResponse(["AuthenticationRequired"]);
const UploadForbiddenResponse = toApiErrorResponse([
	"ApiTokenPermissionRequired",
	"EmailVerificationRequired",
	"AccountRestricted",
	"UploadKeyForbidden",
]);
const UploadUnsupportedResponse = toApiErrorResponse(["UploadUnsupportedType"]);
const UploadInvalidResponse = toApiErrorResponse(["UploadInvalidSize", "UploadContentMismatch"]);
const UploadNotFoundResponse = toApiErrorResponse(["UploadNotFound"]);

export default new Elysia({ prefix: "/uploads" })
	.use(session)
	.post(
		"",
		async ({ profile, authorization, body }) => {
			if (!allowedTypes.has(body.contentType)) throw new UploadUnsupportedType();
			const extension = body.filename.split(".").at(-1)?.toLowerCase() ?? "bin";
			const key = authorization.upload.createKey(extension);
			const url = await storage.presignPut({
				Key: key,
				ContentType: body.contentType,
				ContentLength: body.size,
				Metadata: { owner: profile.unitId },
			});
			return { key, url, expiresIn: 900 };
		},
		{
			access: "contribute:upload:write",
			body: RequestUploadBody,
			response: {
				[StatusCodes.OK]: UploadRequestResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UploadForbiddenResponse,
				[StatusCodes.UNSUPPORTED_MEDIA_TYPE]: UploadUnsupportedResponse,
			},
			detail: { summary: "Create upload URL", tags: ["Uploads"] },
		},
	)
	.post(
		"/complete",
		async ({ authorization, body }) => {
			if (!authorization.upload.owns(body.key)) throw new UploadKeyForbidden(true);
			let head;
			try {
				head = await storage.head({ Key: body.key });
			} catch (error) {
				if (!isStorageNotFound(error)) throw error;
				throw new UploadNotFound();
			}
			if (!head.ContentLength || head.ContentLength > 10_485_760)
				throw new UploadInvalidSize();
			const object = await storage.get({ Key: body.key, Range: "bytes=0-4095" });
			const bytes = await object.Body?.transformToByteArray();
			const detected = bytes ? await fileTypeFromBuffer(bytes) : undefined;
			if (
				!detected ||
				!allowedTypes.has(detected.mime) ||
				detected.mime !== head.ContentType
			) {
				await storage.delete({ Key: body.key });
				throw new UploadContentMismatch();
			}
			return { key: body.key, contentType: detected.mime, size: head.ContentLength };
		},
		{
			access: "contribute:upload:write",
			body: UploadKeyBody,
			response: {
				[StatusCodes.OK]: UploadCompleteResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UploadForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UploadNotFoundResponse,
				[StatusCodes.UNPROCESSABLE_ENTITY]: UploadInvalidResponse,
			},
			detail: { summary: "Validate completed upload", tags: ["Uploads"] },
		},
	)
	.get(
		"/url",
		async ({ authorization, query }) => {
			if (!authorization.upload.owns(query.key)) throw new UploadKeyForbidden(true);
			return { url: await storage.presignGet({ Key: query.key }) };
		},
		{
			access: "upload:read",
			query: UploadUrlQuery,
			response: {
				[StatusCodes.OK]: UploadUrlResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"ApiTokenPermissionRequired",
					"UploadKeyForbidden",
				]),
			},
			detail: { summary: "Create download URL", tags: ["Uploads"] },
		},
	)
	.delete(
		"",
		async ({ authorization, body, status }) => {
			if (!authorization.upload.owns(body.key)) throw new UploadKeyForbidden(true);
			await storage.delete({ Key: body.key });
			return status(StatusCodes.NO_CONTENT, undefined);
		},
		{
			access: "write:upload:write",
			body: UploadKeyBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: UploadForbiddenResponse,
			},
			detail: {
				summary: "Delete upload",
				tags: ["Uploads"],
				responses: NoContentResponse,
			},
		},
	);
