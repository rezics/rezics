import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export class ImageAssetNotFound extends HTTPError.id("ImageAssetNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Image asset not found";
}

export class ImageAssetUploadNotFound extends HTTPError.id(
	"ImageAssetUploadNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Uploaded image object not found";
}

export class ImageAssetUnsupportedType extends HTTPError.id(
	"ImageAssetUnsupportedType",
	StatusCodes.UNSUPPORTED_MEDIA_TYPE,
) {
	override readonly message = "Unsupported image type";
}

export class ImageAssetInvalidSize extends HTTPError.id(
	"ImageAssetInvalidSize",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Uploaded image has invalid size";
}

export class ImageAssetContentMismatch extends HTTPError.id(
	"ImageAssetContentMismatch",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Uploaded image content does not match its declaration";
}

export class ImageAssetInvalidState extends HTTPError.id(
	"ImageAssetInvalidState",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Image asset state does not allow this operation";
}

export class ImageAssetInvalidPresentation extends HTTPError.id(
	"ImageAssetInvalidPresentation",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Image presentation is invalid for this asset and role";
}

export class ImageAssetInUse extends HTTPError.id("ImageAssetInUse", StatusCodes.CONFLICT) {
	override readonly message = "Ready image assets are immutable and cannot be deleted";
}

export const ImageAssetErrors = [
	ImageAssetNotFound,
	ImageAssetUploadNotFound,
	ImageAssetUnsupportedType,
	ImageAssetInvalidSize,
	ImageAssetContentMismatch,
	ImageAssetInvalidState,
	ImageAssetInvalidPresentation,
	ImageAssetInUse,
] as const;
