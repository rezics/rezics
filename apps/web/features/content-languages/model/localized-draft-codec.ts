import {
	isFontAwesomeIconName,
	isFontAwesomeIconPrefix,
	isSingleEmojiGrapheme,
	type PresentedAvatar,
} from "@rezics/avatar";
import { normalizePortableText, type PortableTextValue } from "@rezics/portable-text";
import type { LocalizationImageAssetValue } from "@/features/media/components/localization-image-upload-field";

export function isDraftRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function decodeDraftString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}
export function decodeDraftBoolean(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}
export function decodeDraftNullableString(value: unknown): string | null | undefined {
	return value === null || typeof value === "string" ? value : undefined;
}
export function decodeDraftPortableText(value: unknown): PortableTextValue | undefined {
	return Array.isArray(value) ? normalizePortableText(value) : undefined;
}
export function decodeDraftImageAsset(
	value: unknown,
): LocalizationImageAssetValue | null | undefined {
	if (value === null) return null;
	if (!isDraftRecord(value) || typeof value.id !== "string" || typeof value.url !== "string")
		return;
	return { id: value.id, url: value.url };
}
export function decodeDraftAvatar(value: unknown): PresentedAvatar | null | undefined {
	if (value === null) return null;
	if (!isDraftRecord(value)) return;
	if (value.type === "image") {
		const image = decodeDraftImageAsset(value.image);
		return image ? { type: "image", image } : undefined;
	}
	if (value.type === "emoji")
		return typeof value.emoji === "string" && isSingleEmojiGrapheme(value.emoji)
			? { type: "emoji", emoji: value.emoji }
			: undefined;
	if (value.type !== "icon" || !isDraftRecord(value.icon)) return;
	const { provider, prefix, name } = value.icon;
	if (
		provider !== "font-awesome" ||
		typeof prefix !== "string" ||
		!isFontAwesomeIconPrefix(prefix) ||
		typeof name !== "string" ||
		!isFontAwesomeIconName(name)
	)
		return;
	return { type: "icon", icon: { provider, prefix, name } };
}
