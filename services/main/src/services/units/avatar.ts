import type { AvatarReference, PresentedAvatar } from "@rezics/avatar";

import { imageAssetContentUrl } from "../api/image-assets/service";

export function presentAvatar(avatar: AvatarReference | null): PresentedAvatar | null {
	if (avatar?.type !== "image") return avatar;
	return {
		type: "image",
		image: { id: avatar.image.assetId, url: imageAssetContentUrl(avatar.image.assetId) },
	};
}
