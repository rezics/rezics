"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
	DefaultChineseContentDisplay,
	type ChineseContentDisplay,
	type ContentLanguage,
} from "@rezics/i18n";
import type { PortableTextValue } from "@rezics/portable-text";

import {
	convertChineseContentText,
	convertChinesePortableText,
} from "./chinese-content-conversion";

interface ChineseContentTextEntry {
	readonly language: ContentLanguage | null | undefined;
	readonly value: string;
}

async function convertChineseContentTextEntries(
	entries: readonly ChineseContentTextEntry[],
	display: ChineseContentDisplay,
): Promise<readonly ChineseContentTextEntry[]> {
	return Promise.all(
		entries.map(async (entry) =>
			entry.language === "zh"
				? {
						...entry,
						value: await convertChineseContentText(entry.value, display),
					}
				: entry,
		),
	);
}

const ChineseContentDisplayContext = createContext<ChineseContentDisplay>(
	DefaultChineseContentDisplay,
);

export function ChineseContentDisplayProvider({
	children,
	value,
}: {
	readonly children: ReactNode;
	readonly value: ChineseContentDisplay;
}) {
	return (
		<ChineseContentDisplayContext.Provider value={value}>
			{children}
		</ChineseContentDisplayContext.Provider>
	);
}

export function useChineseContentDisplay(): ChineseContentDisplay {
	return useContext(ChineseContentDisplayContext);
}

interface ConvertedValue<Input, Output> {
	readonly display: ChineseContentDisplay;
	readonly input: Input;
	readonly output: Output;
}

function useChineseDisplayProjection<Input, Output>(
	input: Input,
	language: ContentLanguage | null | undefined,
	project: (input: Input, display: ChineseContentDisplay) => Promise<Output>,
): Input | Output {
	const display = useChineseContentDisplay();
	const [converted, setConverted] = useState<ConvertedValue<Input, Output>>();
	const shouldConvert = language === "zh" && display !== "original";

	useEffect(() => {
		if (!shouldConvert) return;
		let cancelled = false;
		void project(input, display)
			.then((output) => {
				if (!cancelled) setConverted({ display, input, output });
			})
			.catch(() => {
				// Display conversion is optional; the immutable source remains visible.
			});
		return () => {
			cancelled = true;
		};
	}, [display, input, project, shouldConvert]);

	return shouldConvert && converted?.display === display && converted.input === input
		? converted.output
		: input;
}

export function useChineseContentText(
	value: string,
	language: ContentLanguage | null | undefined,
): string {
	return useChineseDisplayProjection(value, language, convertChineseContentText);
}

export function useChineseContentTexts(
	entries: readonly ChineseContentTextEntry[],
): readonly string[] {
	const projected = useChineseDisplayProjection(
		entries,
		entries.some(({ language }) => language === "zh") ? "zh" : undefined,
		convertChineseContentTextEntries,
	);
	return projected.map(({ value }) => value);
}

export function LocalizedText({
	language,
	value,
}: {
	readonly language: ContentLanguage | null | undefined;
	readonly value: string;
}) {
	return <>{useChineseContentText(value, language)}</>;
}

export function useChinesePortableText(
	value: PortableTextValue,
	language: ContentLanguage | null | undefined,
): PortableTextValue {
	return useChineseDisplayProjection(value, language, convertChinesePortableText);
}

export function useRenderedContentLocale(
	language: ContentLanguage | null | undefined,
): ContentLanguage | "zh-Hant" | "zh-Hans" | undefined {
	const display = useChineseContentDisplay();
	if (language !== "zh" || display === "original") return language ?? undefined;
	return display === "hant" ? "zh-Hant" : "zh-Hans";
}
