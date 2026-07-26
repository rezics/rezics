import type { ImageAssetCrop } from "./schema";

export interface ImageAssetPixelTrim {
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
	readonly left: number;
}

/**
 * Convert a provider-neutral normalized crop rectangle to an integer pixel trim.
 *
 * The retained rectangle is rounded outwards so delivery never removes pixels
 * selected by the user. Resize follows trim in the transformation pipeline.
 */
export function cropRectToPixelTrim(
	crop: ImageAssetCrop,
	width: number,
	height: number,
): ImageAssetPixelTrim {
	const left = Math.floor(crop.x * width);
	const top = Math.floor(crop.y * height);
	const retainedRight = Math.ceil((crop.x + crop.width) * width);
	const retainedBottom = Math.ceil((crop.y + crop.height) * height);
	return {
		top,
		right: Math.max(0, width - retainedRight),
		bottom: Math.max(0, height - retainedBottom),
		left,
	};
}

export function pixelTrimToExtract(
	trim: ImageAssetPixelTrim,
	width: number,
	height: number,
): { left: number; top: number; width: number; height: number } {
	const retainedWidth = width - trim.left - trim.right;
	const retainedHeight = height - trim.top - trim.bottom;
	if (retainedWidth <= 0 || retainedHeight <= 0)
		throw new RangeError("Image presentation trim removes the entire image");
	return {
		left: trim.left,
		top: trim.top,
		width: retainedWidth,
		height: retainedHeight,
	};
}
