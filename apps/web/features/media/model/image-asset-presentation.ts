export const ImageAssetPresentationRoles = ["avatar", "banner", "cover"] as const;
export type ImageAssetPresentationRole = (typeof ImageAssetPresentationRoles)[number];

export interface NormalizedImageCrop {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

const RoleAspectRatios = {
	avatar: 1,
	banner: 4,
	cover: 3 / 4,
} as const satisfies Record<ImageAssetPresentationRole, number>;

export function imageAssetPresentationAspectRatio(role: ImageAssetPresentationRole): number {
	return RoleAspectRatios[role];
}

export function defaultNormalizedImageCrop(
	role: ImageAssetPresentationRole,
	imageWidth: number,
	imageHeight: number,
): NormalizedImageCrop {
	const targetAspect = RoleAspectRatios[role];
	const sourceAspect = imageWidth / imageHeight;
	const width = sourceAspect > targetAspect ? (imageHeight * targetAspect) / imageWidth : 1;
	const height = sourceAspect > targetAspect ? 1 : imageWidth / targetAspect / imageHeight;
	const centered = role !== "banner";
	return {
		x: centered ? (1 - width) / 2 : 0,
		y: centered ? (1 - height) / 2 : 0,
		width,
		height,
	};
}

export function clampNormalizedImageCrop(crop: NormalizedImageCrop): NormalizedImageCrop {
	const width = Math.min(1, Math.max(Number.EPSILON, crop.width));
	const height = Math.min(1, Math.max(Number.EPSILON, crop.height));
	return {
		x: Math.min(1 - width, Math.max(0, crop.x)),
		y: Math.min(1 - height, Math.max(0, crop.y)),
		width,
		height,
	};
}
