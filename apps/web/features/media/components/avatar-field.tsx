"use client";

import type { AvatarReference, AvatarType, PresentedAvatar } from "@rezics/avatar";
import {
	Button,
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	IdentityAvatar,
	NativeSelect,
	NativeSelectOption,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	cn,
} from "@rezics/ui";
import { ImagePlus, Pencil, Trash2, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { useTranslation } from "@/i18n/client";
import type { LocalizationImageAssetValue } from "./localization-image-upload-field";
import { LocalizationImageUploadField } from "./localization-image-upload-field";

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

export type AvatarFieldValue = PresentedAvatar;
export type AvatarFieldOption = PresentedAvatar & { readonly label: string };

export function avatarPresentationToInput(avatar: PresentedAvatar | null): AvatarReference | null {
	if (avatar?.type !== "image") return avatar;
	return { type: "image", image: { assetId: avatar.image.id } };
}

function avatarKey(avatar: PresentedAvatar): string {
	switch (avatar.type) {
		case "image":
			return `image:${avatar.image.id}`;
		case "icon":
			return `icon:${avatar.icon.prefix}:${avatar.icon.name}`;
		case "emoji":
			return `emoji:${avatar.emoji}`;
	}
}

function isAvatarType(value: string): value is AvatarType {
	return value === "image" || value === "icon" || value === "emoji";
}

export function AvatarField({
	value,
	onChange,
	fallback = null,
	options = [],
}: {
	readonly value: AvatarFieldValue | null;
	readonly onChange: (value: AvatarFieldValue | null) => void;
	readonly fallback?: AvatarFieldValue | null;
	readonly options?: readonly AvatarFieldOption[];
}) {
	const { t } = useTranslation(["media"]);
	const [open, setOpen] = useState(false);
	const [tab, setTab] = useState<AvatarType>("image");
	const matchingOption = value
		? options.find((option) => avatarKey(option) === avatarKey(value))
		: undefined;
	const displayed = value ?? fallback;
	const imageValue: LocalizationImageAssetValue | null =
		value?.type === "image" ? value.image : null;
	const imageFallback: LocalizationImageAssetValue | null =
		value === null && fallback?.type === "image" ? fallback.image : null;

	function select(nextValue: AvatarFieldValue): void {
		onChange(nextValue);
		setOpen(false);
	}

	return (
		<Dialog
			onOpenChange={({ open: nextOpen }) => {
				setOpen(nextOpen);
				if (nextOpen) setTab(value?.type ?? "image");
			}}
			open={open}
		>
			<div className="grid w-fit justify-items-center gap-2">
				<DialogTrigger asChild>
					<Button
						aria-label={
							displayed ? t.media.avatarPicker.edit : t.media.avatarPicker.setup
						}
						className={cn(
							"group/avatar-field relative size-28 overflow-hidden rounded-full p-0",
							displayed
								? "border-transparent bg-transparent"
								: "border-2 border-dashed bg-muted/30",
						)}
						type="button"
						variant="outline"
					>
						{displayed ? (
							<>
								<IdentityAvatar
									avatar={displayed}
									className="size-full bg-background"
									fallback={<ImagePlus aria-hidden />}
								/>
								<span
									aria-hidden
									className="absolute inset-0 grid place-items-center bg-black/50 text-white opacity-0 transition-opacity group-hover/avatar-field:opacity-100 group-focus-visible/avatar-field:opacity-100 motion-reduce:transition-none"
								>
									<Pencil className="size-5" />
								</span>
								<span
									aria-hidden
									className="absolute end-1.5 bottom-1.5 grid size-7 place-items-center rounded-full border border-background/80 bg-background text-foreground shadow-sm group-hover/avatar-field:opacity-0 group-focus-visible/avatar-field:opacity-0"
								>
									<Pencil className="size-3.5" />
								</span>
							</>
						) : (
							<span className="flex max-w-20 flex-col items-center gap-2 whitespace-normal text-center text-muted-foreground text-xs">
								<ImagePlus aria-hidden className="size-5" />
								{t.media.avatarPicker.setup}
							</span>
						)}
					</Button>
				</DialogTrigger>
				{value === null && fallback ? (
					<p className="text-muted-foreground text-xs">
						{t.media.avatarPicker.inherited}
					</p>
				) : null}
			</div>

			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader className="flex-row items-start justify-between gap-4">
					<div className="grid gap-2">
						<DialogTitle>{t.media.avatarPicker.dialogTitle}</DialogTitle>
						<DialogDescription>
							{t.media.avatarPicker.dialogDescription}
						</DialogDescription>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						{value ? (
							<Button
								onClick={() => {
									onChange(null);
									setOpen(false);
								}}
								size="sm"
								type="button"
								variant="quiet"
							>
								<Trash2 aria-hidden className="size-3.5" />
								{fallback ? t.media.avatarPicker.useInherited : t.media.remove}
							</Button>
						) : null}
						<DialogClose asChild>
							<Button
								aria-label={t.media.avatarPicker.close}
								size="icon-sm"
								type="button"
								variant="quiet"
							>
								<X aria-hidden />
							</Button>
						</DialogClose>
					</div>
				</DialogHeader>
				<DialogBody className="grid gap-4">
					{options.length > 0 ? (
						<NativeSelect
							aria-label={t.media.avatarPicker.source}
							value={
								matchingOption ? avatarKey(matchingOption) : value ? "current" : ""
							}
							onChange={(event) => {
								if (event.currentTarget.value === "current") return;
								const selected = options.find(
									(option) => avatarKey(option) === event.currentTarget.value,
								);
								onChange(selected ?? null);
								if (selected) setTab(selected.type);
							}}
						>
							<NativeSelectOption value="">
								{t.media.roles.avatar.inherit}
							</NativeSelectOption>
							{value && !matchingOption ? (
								<NativeSelectOption value="current">
									{t.media.current}
								</NativeSelectOption>
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

					<Tabs
						className="min-h-0"
						onValueChange={({ value: nextTab }) => {
							if (isAvatarType(nextTab)) setTab(nextTab);
						}}
						value={tab}
					>
						<TabsList
							aria-label={t.media.avatarPicker.typeLabel}
							className="w-full border-b"
							variant="underline"
						>
							<TabsTrigger className="flex-1" value="image">
								{t.media.avatarPicker.tabs.image}
							</TabsTrigger>
							<TabsTrigger className="flex-1" value="icon">
								{t.media.avatarPicker.tabs.icon}
							</TabsTrigger>
							<TabsTrigger className="flex-1" value="emoji">
								{t.media.avatarPicker.tabs.emoji}
							</TabsTrigger>
						</TabsList>
						<TabsContent value="image">
							<LocalizationImageUploadField
								allowRemove={false}
								fallback={imageFallback}
								onChange={(asset) => {
									if (asset) select({ type: "image", image: asset });
								}}
								role="avatar"
								shape="avatar"
								value={imageValue}
							/>
						</TabsContent>
						<TabsContent value="icon">
							<Suspense
								fallback={
									<p className="text-muted-foreground text-sm">
										{t.media.avatarPicker.icon.loading}
									</p>
								}
							>
								<FontAwesomeIconPicker
									onSelect={(icon) => select({ type: "icon", icon })}
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
									onSelect={(emoji) => select({ type: "emoji", emoji })}
								/>
							</Suspense>
						</TabsContent>
					</Tabs>
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}
