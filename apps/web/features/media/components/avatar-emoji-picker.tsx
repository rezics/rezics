"use client";

import { EmojiPicker, type Emoji } from "frimousse";
import { Button } from "@rezics/ui";
import type { UiLocale } from "@rezics/i18n";
import { useEffect, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { AvatarEmojiDataBaseUrl } from "../model/avatar-emoji-data";
import {
	readRecentEmojiChoices,
	rememberRecentEmojiChoice,
	type RecentEmojiChoice,
	type AvatarEmojiLocale,
} from "../model/avatar-emoji-recents";

const EmojiLocaleByUiLocale = {
	de: "de",
	en: "en",
	es: "es",
	fr: "fr",
	ja: "ja",
	ko: "ko",
	"zh-Hans": "zh",
	"zh-Hant": "zh-hant",
} as const satisfies Record<UiLocale, AvatarEmojiLocale>;

export function AvatarEmojiPicker({ onSelect }: { readonly onSelect: (emoji: string) => void }) {
	const { t, locale } = useTranslation(["media"]);
	const [query, setQuery] = useState("");
	const [recent, setRecent] = useState<readonly RecentEmojiChoice[]>([]);
	const emojiLocale = EmojiLocaleByUiLocale[locale.target];

	useEffect(() => {
		setRecent(readRecentEmojiChoices(window.localStorage, emojiLocale));
	}, [emojiLocale]);

	function selectEmoji(choice: Emoji): void {
		const recentChoice = { emoji: choice.emoji, label: choice.label };
		rememberRecentEmojiChoice(window.localStorage, emojiLocale, recentChoice);
		setRecent(readRecentEmojiChoices(window.localStorage, emojiLocale));
		onSelect(choice.emoji);
	}

	return (
		<EmojiPicker.Root
			className="isolate flex h-80 min-w-0 flex-col overflow-hidden rounded-xl border bg-background"
			emojibaseUrl={AvatarEmojiDataBaseUrl}
			locale={emojiLocale}
			onEmojiSelect={selectEmoji}
		>
			<div className="flex items-center gap-2 p-2">
				<EmojiPicker.Search
					aria-label={t.media.avatarPicker.emoji.search}
					className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/32"
					onChange={(event) => setQuery(event.currentTarget.value)}
					placeholder={t.media.avatarPicker.emoji.search}
					value={query}
				/>
				<EmojiPicker.SkinToneSelector
					aria-label={t.media.avatarPicker.emoji.skinTone}
					className="size-9 shrink-0 rounded-lg border border-input text-xl outline-none hover:bg-accent focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/32"
				/>
			</div>
			{query.length === 0 && recent.length > 0 ? (
				<div className="border-t px-2 pt-2">
					<p className="px-1 pb-1 font-medium text-muted-foreground text-xs">
						{t.media.avatarPicker.recent}
					</p>
					<div className="flex gap-1 overflow-x-auto pb-2">
						{recent.map((choice) => (
							<Button
								aria-label={choice.label}
								className="size-9 min-w-9 p-0 text-xl"
								key={choice.emoji}
								onClick={() =>
									selectEmoji({ emoji: choice.emoji, label: choice.label })
								}
								title={choice.label}
								type="button"
								variant="quiet"
							>
								{choice.emoji}
							</Button>
						))}
					</div>
				</div>
			) : null}
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
