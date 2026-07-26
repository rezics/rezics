import type { ImageAssetPresentationRole } from "../../database/schema";
import { ImageAssetInvalidPresentation } from "./errors";
import type { ImageAssetCrop, UpsertImageAssetPresentationBody } from "./schema";

const PresentationAspectRatios = {
	avatar: 1,
	banner: 4,
	cover: 3 / 4,
} as const satisfies Record<ImageAssetPresentationRole, number>;

const normalizedPrecision = 100_000_000;
const aspectTolerance = 0.005;

function roundNormalized(value: number): number {
	return Math.round(value * normalizedPrecision) / normalizedPrecision;
}

function assertDimensions(width: number, height: number): void {
	if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0)
		throw new ImageAssetInvalidPresentation();
}

export function imageAssetPresentationContentUrl(
	assetId: string,
	role: ImageAssetPresentationRole,
	revision?: number,
): string {
	const path = `/image-assets/${assetId}/presentations/${role}/content`;
	return revision ? `${path}?v=${revision}` : path;
}

/** Create the largest in-bounds crop for a role and anchor it deterministically. */
export function defaultImageAssetCrop(
	role: ImageAssetPresentationRole,
	width: number,
	height: number,
): ImageAssetCrop {
	assertDimensions(width, height);
	const targetAspect = PresentationAspectRatios[role];
	const sourceAspect = width / height;
	const cropWidth = sourceAspect > targetAspect ? (height * targetAspect) / width : 1;
	const cropHeight = sourceAspect > targetAspect ? 1 : width / targetAspect / height;
	const centered = role !== "banner";
	return {
		x: roundNormalized(centered ? (1 - cropWidth) / 2 : 0),
		y: roundNormalized(centered ? (1 - cropHeight) / 2 : 0),
		width: roundNormalized(cropWidth),
		height: roundNormalized(cropHeight),
	};
}

export function defaultImageAssetPresentation(
	role: ImageAssetPresentationRole,
	width: number,
	height: number,
): UpsertImageAssetPresentationBody {
	return role === "cover"
		? { fit: "contain" }
		: { fit: "crop", crop: defaultImageAssetCrop(role, width, height) };
}

export function validateImageAssetPresentation(
	role: ImageAssetPresentationRole,
	width: number,
	height: number,
	input: UpsertImageAssetPresentationBody,
): UpsertImageAssetPresentationBody {
	assertDimensions(width, height);
	if (input.fit === "contain") {
		if (role !== "cover") throw new ImageAssetInvalidPresentation();
		return input;
	}
	const values = [input.crop.x, input.crop.y, input.crop.width, input.crop.height];
	if (
		values.some((value) => !Number.isFinite(value)) ||
		input.crop.x < 0 ||
		input.crop.y < 0 ||
		input.crop.width <= 0 ||
		input.crop.height <= 0 ||
		input.crop.x + input.crop.width > 1 + Number.EPSILON * 16 ||
		input.crop.y + input.crop.height > 1 + Number.EPSILON * 16
	)
		throw new ImageAssetInvalidPresentation();

	const x = roundNormalized(input.crop.x);
	const y = roundNormalized(input.crop.y);
	const normalizedWidth = Math.min(roundNormalized(input.crop.width), roundNormalized(1 - x));
	const normalizedHeight = Math.min(roundNormalized(input.crop.height), roundNormalized(1 - y));
	if (normalizedWidth <= 0 || normalizedHeight <= 0) throw new ImageAssetInvalidPresentation();
	const actualAspect = (normalizedWidth * width) / (normalizedHeight * height);
	const targetAspect = PresentationAspectRatios[role];
	if (Math.abs(actualAspect / targetAspect - 1) > aspectTolerance)
		throw new ImageAssetInvalidPresentation();
	return {
		fit: "crop",
		crop: {
			x,
			y,
			width: normalizedWidth,
			height: normalizedHeight,
		},
	};
}

export function toImageAssetPresentationColumns(input: UpsertImageAssetPresentationBody): {
	fit: "contain" | "crop";
	cropX: number | null;
	cropY: number | null;
	cropWidth: number | null;
	cropHeight: number | null;
} {
	return input.fit === "contain"
		? {
				fit: "contain",
				cropX: null,
				cropY: null,
				cropWidth: null,
				cropHeight: null,
			}
		: {
				fit: "crop",
				cropX: input.crop.x,
				cropY: input.crop.y,
				cropWidth: input.crop.width,
				cropHeight: input.crop.height,
			};
}

export const imageAssetPresentationOutputSize = {
	avatar: { width: 512, height: 512 },
	banner: { width: 2400, height: 600 },
	cover: { width: 1200, height: 1600 },
} as const satisfies Record<
	ImageAssetPresentationRole,
	{ readonly width: number; readonly height: number }
>;
