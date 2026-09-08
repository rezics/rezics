import type { LocalizedDraftCodec } from "@/features/content-languages/hooks/use-content-language-editor";
import {
	decodeDraftAvatar,
	decodeDraftImageAsset,
	decodeDraftPortableText,
	decodeDraftString,
	isDraftRecord,
} from "@/features/content-languages/model/localized-draft-codec";
import type { AvatarFieldValue } from "@/features/media/components/avatar-field";
import type { LocalizationImageAssetValue } from "@/features/media/components/localization-image-upload-field";
import type { PortableTextValue } from "@rezics/portable-text";
export type CatalogEditorialDraft = {
	summary: string;
	description: PortableTextValue;
	avatar: AvatarFieldValue | null;
	banner: LocalizationImageAssetValue | null;
	cover: LocalizationImageAssetValue | null;
	avatarEdited: boolean;
	bannerEdited: boolean;
	coverEdited: boolean;
};
export const CatalogEditorialDraftCodec: LocalizedDraftCodec<CatalogEditorialDraft> = {
	version: 1,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const summary = decodeDraftString(value.summary),
			description = decodeDraftPortableText(value.description),
			avatar = decodeDraftAvatar(value.avatar),
			banner = decodeDraftImageAsset(value.banner),
			cover = decodeDraftImageAsset(value.cover);
		if (
			summary === undefined ||
			description === undefined ||
			avatar === undefined ||
			banner === undefined ||
			cover === undefined ||
			typeof value.avatarEdited !== "boolean" ||
			typeof value.bannerEdited !== "boolean" ||
			typeof value.coverEdited !== "boolean"
		)
			return;
		return {
			summary,
			description,
			avatar,
			banner,
			cover,
			avatarEdited: value.avatarEdited,
			bannerEdited: value.bannerEdited,
			coverEdited: value.coverEdited,
		};
	},
};
