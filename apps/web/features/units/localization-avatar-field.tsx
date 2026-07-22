"use client";

import type { AvatarReference, PresentedAvatar } from "@rezics/avatar";
import {
	Button,
	IdentityAvatar,
	NativeSelect,
	NativeSelectOption,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@rezics/ui";
import { ImagePlus, Trash2 } from "lucide-react";
import { lazy, Suspense } from "react";

import { useTranslation } from "@/i18n/client";
import {
	LocalizationImageUploadField,
	type LocalizationImageAssetValue,
} from "./localization-image-upload-field";

const FontAwesomeIconPicker = lazy(() =>
	import("./font-awesome-icon-picker").then(({ FontAwesomeIconPicker }) => ({
		default: FontAwesomeIconPicker,
	})),
);
const AvatarEmojiPicker = lazy(() =>
	import("./avatar-emoji-picker").then(({ AvatarEmojiPicker }) => ({
		default: AvatarEmojiPicker,
	})),
);

export type LocalizationAvatarValue = PresentedAvatar;
export type LocalizationAvatarOption = PresentedAvatar & { readonly label: string };

export function avatarPresentationToInput(avatar: PresentedAvatar | null): AvatarReference | null {
	if (avatar?.type !== "image") return avatar;
	return { type: "image", image: { assetId: avatar.image.id } };
}

function avatarKey(avatar: PresentedAvatar): string {
	switch (avatar.type) {
		case "image":
			return `image:${avatar.image.id}`;
		case "emoji":
			return `emoji:${avatar.emoji}`;
		case "icon":
			return `icon:${avatar.icon.prefix}:${avatar.icon.name}`;
	}
}

export function LocalizationAvatarField({
	value,
	onChange,
	fallback = null,
	options = [],
}: {
	readonly value: LocalizationAvatarValue | null;
	readonly onChange: (value: LocalizationAvatarValue | null) => void;
	readonly fallback?: LocalizationAvatarValue | null;
	readonly options?: readonly LocalizationAvatarOption[];
}) {
	const { t } = useTranslation(["media"]);
	const matchingOption = value
		? options.find((option) => avatarKey(option) === avatarKey(value))
		: undefined;
	const displayed = value ?? fallback;
	const imageValue: LocalizationImageAssetValue | null =
		value?.type === "image" ? value.image : null;

	return (
		<div className="grid gap-3">
			{options.length > 0 ? (
				<NativeSelect
					value={matchingOption ? avatarKey(matchingOption) : value ? "current" : ""}
					onChange={(event) => {
						if (event.currentTarget.value === "current") return;
						const selected = options.find(
							(option) => avatarKey(option) === event.currentTarget.value,
						);
						onChange(selected ?? null);
					}}
				>
					<NativeSelectOption value="">{t.media.roles.avatar.inherit}</NativeSelectOption>
					{value && !matchingOption ? (
						<NativeSelectOption value="current">{t.media.current}</NativeSelectOption>
					) : null}
					{options.map((option) => (
						<NativeSelectOption
							key={`${option.label}:${avatarKey(option)}`}
							value={avatarKey(option)}
						>
							{option.label}
						</NativeSelectOption>
					))}
				</NativeSelect>
			) : null}

			{displayed ? (
				<div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
					<IdentityAvatar
						avatar={displayed}
						className="size-16 bg-background"
						fallback={<ImagePlus aria-hidden />}
					/>
					<div className="min-w-0">
						<p className="font-medium text-sm">{t.media.avatarPicker.preview}</p>
						{!value ? (
							<p className="text-muted-foreground text-xs">
								{t.media.avatarPicker.inherited}
							</p>
						) : null}
					</div>
				</div>
			) : null}

			<Tabs defaultValue={value?.type ?? "icon"}>
				<TabsList aria-label={t.media.avatarPicker.typeLabel}>
					<TabsTrigger value="icon">{t.media.avatarPicker.tabs.icon}</TabsTrigger>
					<TabsTrigger value="emoji">{t.media.avatarPicker.tabs.emoji}</TabsTrigger>
					<TabsTrigger value="image">{t.media.avatarPicker.tabs.image}</TabsTrigger>
				</TabsList>
				<TabsContent value="icon">
					<Suspense
						fallback={
							<p className="text-muted-foreground text-sm">
								{t.media.avatarPicker.icon.loading}
							</p>
						}
					>
						<FontAwesomeIconPicker
							onSelect={(icon) => onChange({ type: "icon", icon })}
						/>
					</Suspense>
				</TabsContent>
				<TabsContent value="emoji">
					<Suspense
						fallback={
							<p className="text-muted-foreground text-sm">
								{t.media.avatarPicker.emoji.loading}
							</p>
						}
					>
						<AvatarEmojiPicker
							onSelect={(emoji) => onChange({ type: "emoji", emoji })}
						/>
					</Suspense>
				</TabsContent>
				<TabsContent value="image">
					<LocalizationImageUploadField
						allowRemove={false}
						onChange={(asset) =>
							onChange(asset ? { type: "image", image: asset } : null)
						}
						role="avatar"
						shape="avatar"
						value={imageValue}
					/>
				</TabsContent>
			</Tabs>

			{value ? (
				<Button
					className="w-fit"
					onClick={() => onChange(null)}
					size="sm"
					type="button"
					variant="quiet"
				>
					<Trash2 aria-hidden className="size-3.5" />
					{t.media.remove}
				</Button>
			) : null}
		</div>
	);
}
