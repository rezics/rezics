import { StatusCodes } from "http-status-codes";
import Elysia, { t } from "elysia";

import { resolveIdentity } from "../../auth/session";
import { storage } from "../../storage";
import { toApiErrorResponse } from "../schema/response";
import { resolveDerivedImageAssetContent } from "./derived-content";
import { ImageAssetNotFound } from "./errors";
import { findImageAsset, findImageAssetPresentation } from "./service";
import { ImageAssetParams, ImageAssetPresentationParams } from "./schema";

async function authorizeImageAsset(
	request: Request,
	asset: NonNullable<Awaited<ReturnType<typeof findImageAsset>>>,
): Promise<void> {
	if (asset.access === "private") {
		const viewer = (await resolveIdentity(request, "upload:read")).profile;
		if (viewer?.unitId !== asset.ownerProfileId) throw new ImageAssetNotFound();
	}
}

export default new Elysia({ prefix: "/image-assets" })
	.get(
		"/:id/presentations/:role/content",
		async ({ params, request }) => {
			const [asset, presentation] = await Promise.all([
				findImageAsset(params.id),
				findImageAssetPresentation(params.id, params.role),
			]);
			if (!asset || asset.status !== "ready" || !presentation) throw new ImageAssetNotFound();
			await authorizeImageAsset(request, asset);
			const resolved = await resolveDerivedImageAssetContent(
				asset,
				presentation,
				request.headers.get("accept"),
			);
			return new Response(null, {
				status: StatusCodes.MOVED_TEMPORARILY,
				headers: {
					location: resolved.location,
					"cache-control": asset.access === "public" ? "public, max-age=60" : "private, no-store",
					vary: "Accept",
				},
			});
		},
		{
			params: ImageAssetPresentationParams,
			response: {
				[StatusCodes.MOVED_TEMPORARILY]: t.Void(),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["ImageAssetNotFound"]),
			},
			detail: {
				summary: "Resolve rendered image asset presentation",
				tags: ["Image Assets"],
			},
		},
	)
	.get(
		"/:id/content",
		async ({ params, request }) => {
			const asset = await findImageAsset(params.id);
			if (!asset || asset.status !== "ready") throw new ImageAssetNotFound();
			await authorizeImageAsset(request, asset);
			return new Response(null, {
				status: StatusCodes.MOVED_TEMPORARILY,
				headers: {
					location: await storage.presignGet({ Key: asset.storageKey }),
					"cache-control": asset.access === "public" ? "public, max-age=60" : "private, no-store",
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
