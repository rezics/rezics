import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

export class ImageAssetNotFound extends Data.TaggedError("ImageAssetNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ImageAssetNotFound.status;
	readonly message = "Image asset not found";
}

export class ImageAssetUploadNotFound extends Data.TaggedError("ImageAssetUploadNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ImageAssetUploadNotFound.status;
	readonly message = "Uploaded image object not found";
}

export class ImageAssetUnsupportedType extends Data.TaggedError("ImageAssetUnsupportedType") {
	static readonly status = StatusCodes.UNSUPPORTED_MEDIA_TYPE as const;
	readonly status = ImageAssetUnsupportedType.status;
	readonly message = "Unsupported image type";
}

export class ImageAssetInvalidSize extends Data.TaggedError("ImageAssetInvalidSize") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ImageAssetInvalidSize.status;
	readonly message = "Uploaded image has invalid size";
}

export class ImageAssetContentMismatch extends Data.TaggedError("ImageAssetContentMismatch") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ImageAssetContentMismatch.status;
	readonly message = "Uploaded image content does not match its declaration";
}

export class ImageAssetInvalidState extends Data.TaggedError("ImageAssetInvalidState") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ImageAssetInvalidState.status;
	readonly message = "Image asset state does not allow this operation";
}

export class ImageAssetInvalidPresentation extends Data.TaggedError(
	"ImageAssetInvalidPresentation",
) {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ImageAssetInvalidPresentation.status;
	readonly message = "Image presentation is invalid for this asset and role";
}

export class ImageAssetInUse extends Data.TaggedError("ImageAssetInUse") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ImageAssetInUse.status;
	readonly message = "Ready image assets are immutable and cannot be deleted";
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
