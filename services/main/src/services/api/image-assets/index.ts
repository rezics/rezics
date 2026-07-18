import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import session from "../../auth/session";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	completeImageAsset,
	createImageAsset,
	deletePendingImageAsset,
	getOwnedImageAsset,
} from "./service";
import {
	CreateImageAssetBody,
	CreateImageAssetResponse,
	ImageAssetParams,
	ImageAssetResponse,
} from "./schema";

const AuthenticationRequiredResponse = toApiErrorResponse(["AuthenticationRequired"]);
const ImageAssetNotFoundResponse = toApiErrorResponse(["ImageAssetNotFound"]);
const ImageAssetInvalidResponse = toApiErrorResponse([
	"ImageAssetInvalidSize",
	"ImageAssetContentMismatch",
]);

export default new Elysia({ prefix: "/image-assets" })
	.use(session)
	.post("", ({ profile, body }) => createImageAsset(profile.unitId, body), {
		access: "contribute:upload:write",
		body: CreateImageAssetBody,
		response: {
			[StatusCodes.OK]: CreateImageAssetResponse,
			[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
			[StatusCodes.UNSUPPORTED_MEDIA_TYPE]: toApiErrorResponse(["ImageAssetUnsupportedType"]),
		},
		detail: { summary: "Create image asset upload", tags: ["Image Assets"] },
	})
	.post("/:id/complete", ({ profile, params }) => completeImageAsset(profile.unitId, params.id), {
		access: "contribute:upload:write",
		params: ImageAssetParams,
		response: {
			[StatusCodes.OK]: ImageAssetResponse,
			[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
			[StatusCodes.NOT_FOUND]: toApiErrorResponse([
				"ImageAssetNotFound",
				"ImageAssetUploadNotFound",
			]),
			[StatusCodes.CONFLICT]: toApiErrorResponse(["ImageAssetInvalidState"]),
			[StatusCodes.UNPROCESSABLE_ENTITY]: ImageAssetInvalidResponse,
		},
		detail: { summary: "Complete image asset upload", tags: ["Image Assets"] },
	})
	.get("/:id", ({ profile, params }) => getOwnedImageAsset(profile.unitId, params.id), {
		access: "upload:read",
		params: ImageAssetParams,
		response: {
			[StatusCodes.OK]: ImageAssetResponse,
			[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
			[StatusCodes.NOT_FOUND]: ImageAssetNotFoundResponse,
		},
		detail: { summary: "Get image asset", tags: ["Image Assets"] },
	})
	.delete(
		"/:id",
		async ({ profile, params, status }) => {
			await deletePendingImageAsset(profile.unitId, params.id);
			return status(StatusCodes.NO_CONTENT, undefined);
		},
		{
			access: "write:upload:write",
			params: ImageAssetParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.NOT_FOUND]: ImageAssetNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ImageAssetInUse"]),
			},
			detail: {
				summary: "Delete incomplete image asset",
				tags: ["Image Assets"],
				responses: NoContentResponse,
			},
		},
	);
