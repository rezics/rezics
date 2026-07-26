import type { AvatarReference, PresentedAvatar } from "@rezics/avatar";

import { imageAssetPresentationContentUrl } from "../api/image-assets/presentation";

export function presentAvatar(avatar: AvatarReference | null): PresentedAvatar | null {
	if (avatar?.type !== "image") return avatar;
	return {
		type: "image",
		image: {
			id: avatar.image.assetId,
			url: imageAssetPresentationContentUrl(avatar.image.assetId, "avatar"),
		},
	};
}
