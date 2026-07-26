export const ImageUploadContentTypes = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/avif",
] as const;

export const MaximumImageUploadBytes = 10_485_760;

export type ImageUploadContentType = (typeof ImageUploadContentTypes)[number];

export type ImageUploadValidation =
	| {
			readonly contentType: ImageUploadContentType;
			readonly ok: true;
	  }
	| {
			readonly ok: false;
			readonly reason: "empty" | "too-large" | "unsupported-type";
	  };

export function validateImageUploadCandidate(
	candidate: Pick<File, "size" | "type">,
): ImageUploadValidation {
	const contentType = ImageUploadContentTypes.find((type) => type === candidate.type);
	if (!contentType) return { ok: false, reason: "unsupported-type" };
	if (candidate.size < 1) return { ok: false, reason: "empty" };
	if (candidate.size > MaximumImageUploadBytes) return { ok: false, reason: "too-large" };
	return { contentType, ok: true };
}
