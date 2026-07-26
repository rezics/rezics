import sharp from "sharp";

import { isStorageNotFound, storage } from "../../storage";
import { imageAssetPresentationOutputSize } from "./presentation";
import type { findImageAsset, findImageAssetPresentation } from "./service";
import { cropRectToPixelTrim, pixelTrimToExtract } from "./transformation";

const maximumImagePixels = 40_000_000;
const alphaCapableOriginalTypes = new Set(["image/avif", "image/png", "image/webp"]);

type FoundImageAsset = NonNullable<Awaited<ReturnType<typeof findImageAsset>>>;
type FoundImageAssetPresentation = NonNullable<
	Awaited<ReturnType<typeof findImageAssetPresentation>>
>;

type DerivedFormat = "avif" | "webp" | "jpeg" | "png";

const formatContentTypes = {
	avif: "image/avif",
	webp: "image/webp",
	jpeg: "image/jpeg",
	png: "image/png",
} as const satisfies Record<DerivedFormat, string>;

interface AcceptedMediaRange {
	readonly range: string;
	readonly quality: number;
}

function parseAcceptHeader(accept: string | null): readonly AcceptedMediaRange[] {
	if (!accept) return [];
	return accept.split(",").map((entry) => {
		const [range = "", ...parameters] = entry.trim().toLowerCase().split(";");
		const qualityParameter = parameters
			.map((parameter) => parameter.trim())
			.find((parameter) => parameter.startsWith("q="));
		const parsedQuality = qualityParameter ? Number(qualityParameter.slice(2)) : 1;
		return {
			range,
			quality:
				Number.isFinite(parsedQuality) && parsedQuality >= 0 && parsedQuality <= 1
					? parsedQuality
					: 0,
		};
	});
}

function acceptedQuality(ranges: readonly AcceptedMediaRange[], contentType: string): number {
	// Modern formats double as capability detection. A wildcard alone is not
	// enough proof that the image decoder supports AVIF or WebP.
	const match = ranges.find((entry) => entry.range === contentType);
	return match?.quality ?? 0;
}

export function negotiateImageAssetFormat(
	accept: string | null,
	originalContentType: string,
): DerivedFormat {
	const ranges = parseAcceptHeader(accept);
	const avifQuality = acceptedQuality(ranges, "image/avif");
	const webpQuality = acceptedQuality(ranges, "image/webp");
	if (avifQuality > 0 && avifQuality >= webpQuality) return "avif";
	if (webpQuality > 0) return "webp";
	return alphaCapableOriginalTypes.has(originalContentType) ? "png" : "jpeg";
}

function derivedStorageKey(
	asset: FoundImageAsset,
	presentation: FoundImageAssetPresentation,
	format: DerivedFormat,
): string {
	const size = imageAssetPresentationOutputSize[presentation.role];
	return `image-objects/${asset.id}/presentations/${presentation.role}/v${presentation.revision}/${size.width}x${size.height}.${format}`;
}

async function derivedExists(storageKey: string): Promise<boolean> {
	try {
		await storage.head({ Key: storageKey });
		return true;
	} catch (error) {
		if (isStorageNotFound(error)) return false;
		throw error;
	}
}

function applyOutputFormat(pipeline: sharp.Sharp, format: DerivedFormat): sharp.Sharp {
	switch (format) {
		case "avif":
			return pipeline.avif({ effort: 4, quality: 72 });
		case "webp":
			return pipeline.webp({ quality: 82 });
		case "jpeg":
			return pipeline.jpeg({ mozjpeg: true, quality: 85 });
		case "png":
			return pipeline.png({ compressionLevel: 9 });
	}
}

async function generateDerivedImage(
	asset: FoundImageAsset,
	presentation: FoundImageAssetPresentation,
	format: DerivedFormat,
	storageKey: string,
): Promise<void> {
	if (!asset.width || !asset.height || !asset.contentType)
		throw new Error("Ready image asset metadata is incomplete");
	const original = await storage.get({ Key: asset.storageKey });
	const bytes = await original.Body?.transformToByteArray();
	if (!bytes) throw new Error("Image asset content is empty");

	const outputSize = imageAssetPresentationOutputSize[presentation.role];
	let pipeline = sharp(bytes, {
		animated: false,
		limitInputPixels: maximumImagePixels,
	}).rotate();
	if (presentation.fit === "crop") {
		const { cropX, cropY, cropWidth, cropHeight } = presentation;
		if (cropX === null || cropY === null || cropWidth === null || cropHeight === null)
			throw new Error("Stored crop presentation is incomplete");
		const trim = cropRectToPixelTrim(
			{ x: cropX, y: cropY, width: cropWidth, height: cropHeight },
			asset.width,
			asset.height,
		);
		pipeline = pipeline
			.extract(pixelTrimToExtract(trim, asset.width, asset.height))
			.resize(outputSize.width, outputSize.height, { fit: "fill" });
	} else {
		if (presentation.role !== "cover")
			throw new Error("Contain presentation is only valid for covers");
		pipeline = pipeline.resize(outputSize.width, outputSize.height, {
			fit: "inside",
			withoutEnlargement: true,
		});
	}

	const body = await applyOutputFormat(pipeline, format).toBuffer();
	await storage.put({
		Key: storageKey,
		Body: body,
		ContentLength: body.byteLength,
		ContentType: formatContentTypes[format],
		CacheControl:
			asset.access === "public" ? "public, max-age=31536000, immutable" : "private, no-store",
		Metadata: {
			image_asset_id: asset.id,
			presentation_role: presentation.role,
			presentation_revision: String(presentation.revision),
		},
	});
}

export async function resolveDerivedImageAssetContent(
	asset: FoundImageAsset,
	presentation: FoundImageAssetPresentation,
	accept: string | null,
): Promise<{ readonly location: string }> {
	if (!asset.contentType) throw new Error("Ready image asset has no content type");
	const format = negotiateImageAssetFormat(accept, asset.contentType);
	const storageKey = derivedStorageKey(asset, presentation, format);
	if (!(await derivedExists(storageKey)))
		await generateDerivedImage(asset, presentation, format, storageKey);
	return {
		location: await storage.presignGet({ Key: storageKey }),
	};
}
