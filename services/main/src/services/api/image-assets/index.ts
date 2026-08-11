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
	upsertImageAssetPresentation,
} from "./service";
import {
	CompleteImageAssetBody,
	CreateImageAssetBody,
	CreateImageAssetResponse,
	ImageAssetParams,
	ImageAssetPresentationParams,
	ImageAssetPresentationResponse,
	ImageAssetResponse,
	UpsertImageAssetPresentationBody,
} from "./schema";

const AuthenticationRequiredResponse = toApiErrorResponse(["AuthenticationRequired"]);
const ImageAssetNotFoundResponse = toApiErrorResponse(["ImageAssetNotFound"]);
const ImageAssetUploadInvalidResponse = toApiErrorResponse([
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
	.post(
		"/:id/complete",
		({ profile, params, body }) => completeImageAsset(profile.unitId, params.id, body),
		{
			access: "contribute:upload:write",
			params: ImageAssetParams,
			body: CompleteImageAssetBody,
			response: {
				[StatusCodes.OK]: ImageAssetResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"ImageAssetNotFound",
					"ImageAssetUploadNotFound",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ImageAssetInvalidState"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: ImageAssetUploadInvalidResponse,
			},
			detail: { summary: "Complete image asset upload", tags: ["Image Assets"] },
		},
	)
	.put(
		"/:id/presentations/:role",
		({ profile, params, body }) =>
			upsertImageAssetPresentation(profile.unitId, params.id, params.role, body),
		{
			access: "contribute:upload:write",
			params: ImageAssetPresentationParams,
			body: UpsertImageAssetPresentationBody,
			response: {
				[StatusCodes.OK]: ImageAssetPresentationResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.NOT_FOUND]: ImageAssetNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ImageAssetInvalidState"]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["ImageAssetInvalidPresentation"]),
			},
			detail: { summary: "Update image asset presentation", tags: ["Image Assets"] },
		},
	)
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
			access: "contribute:upload:write",
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
