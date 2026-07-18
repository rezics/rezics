import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import { resolveIdentity } from "../../auth/session";
import { storage } from "../../storage";
import { toApiErrorResponse } from "../schema/response";
import { ImageAssetNotFound } from "./errors";
import { findImageAsset } from "./service";
import { ImageAssetParams } from "./schema";

export default new Elysia({ prefix: "/image-assets" }).get(
	"/:id/content",
	async ({ params, request }) => {
		const asset = await findImageAsset(params.id);
		if (!asset || asset.status !== "ready") throw new ImageAssetNotFound();
		if (asset.access === "private") {
			const viewer = (await resolveIdentity(request.headers, "upload:read")).profile;
			if (viewer?.unitId !== asset.ownerProfileId) throw new ImageAssetNotFound();
		}
		return new Response(null, {
			status: StatusCodes.MOVED_TEMPORARILY,
			headers: {
				location: await storage.presignGet({ Key: asset.storageKey }),
				"cache-control":
					asset.access === "public" ? "public, max-age=60" : "private, no-store",
			},
		});
	},
	{
		params: ImageAssetParams,
		response: {
			[StatusCodes.MOVED_TEMPORARILY]: t.Void(),
			[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ImageAssetNotFound"]),
		},
		detail: { summary: "Resolve image asset content", tags: ["Image Assets"] },
	},
);
