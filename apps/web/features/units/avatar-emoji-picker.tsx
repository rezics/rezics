"use client";

import { EmojiPicker } from "frimousse";
import { Button } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";

export function AvatarEmojiPicker({ onSelect }: { readonly onSelect: (emoji: string) => void }) {
	const { t, locale } = useTranslation(["media"]);
	return (
		<EmojiPicker.Root
			className="isolate flex h-80 min-w-0 flex-col overflow-hidden rounded-xl border bg-background"
			emojibaseUrl="https://cdn.jsdelivr.net/npm/emojibase-data@16.0.2"
			locale={locale.target === "zh-Hant" ? "zh-hant" : "en"}
			onEmojiSelect={({ emoji }) => onSelect(emoji)}
		>
			<EmojiPicker.Search
				aria-label={t.media.avatarPicker.emoji.search}
				className="m-2 h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/32"
				placeholder={t.media.avatarPicker.emoji.search}
			/>
			<EmojiPicker.Viewport className="relative flex-1 outline-none">
				<EmojiPicker.Loading className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
					{t.media.avatarPicker.emoji.loading}
				</EmojiPicker.Loading>
				<EmojiPicker.Empty className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
					{t.media.avatarPicker.emoji.empty}
				</EmojiPicker.Empty>
				<EmojiPicker.List
					className="select-none pb-2"
					components={{
						CategoryHeader: ({ category, ...props }) => (
							<div
								className="bg-background/95 px-3 py-2 font-medium text-muted-foreground text-xs backdrop-blur"
								{...props}
							>
								{category.label}
							</div>
						),
						Row: (props) => <div className="scroll-my-2 px-2" {...props} />,
						Emoji: ({ emoji, ...props }) => (
							<Button
								{...props}
								aria-label={emoji.label}
								className="size-9 min-w-9 p-0 text-xl data-[active]:bg-accent"
								type="button"
								variant="quiet"
							>
								{emoji.emoji}
							</Button>
						),
					}}
				/>
			</EmojiPicker.Viewport>
		</EmojiPicker.Root>
	);
}
