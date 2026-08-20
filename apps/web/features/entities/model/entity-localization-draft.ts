import type { PortableTextValue } from "@rezics/portable-text";

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

export interface EntityLocalizationDraft {
	readonly title: string;
	readonly summary: string;
	readonly description: PortableTextValue;
	readonly avatar: AvatarFieldValue | null;
	readonly banner: LocalizationImageAssetValue | null;
	readonly cover: LocalizationImageAssetValue | null;
}

export const EntityLocalizationDraftCodec: LocalizedDraftCodec<EntityLocalizationDraft> = {
	version: 2,
	decode(value) {
		if (!isDraftRecord(value)) return;
		const title = decodeDraftString(value.title);
		const summary = decodeDraftString(value.summary);
		const description = decodeDraftPortableText(value.description);
		const avatar = decodeDraftAvatar(value.avatar);
		const banner = decodeDraftImageAsset(value.banner);
		const cover = decodeDraftImageAsset(value.cover);
		return title === undefined ||
			summary === undefined ||
			!description ||
			avatar === undefined ||
			banner === undefined ||
			cover === undefined
			? undefined
			: { title, summary, description, avatar, banner, cover };
	},
};
