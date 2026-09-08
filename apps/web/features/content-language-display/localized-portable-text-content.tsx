"use client";

import type { PortableTextValue } from "@rezics/portable-text";
import { PortableTextContent } from "@rezics/ui";
import type { ComponentProps } from "react";

import {
	useChinesePortableText,
	useRenderedContentLocale,
} from "./chinese-content-display-context";

type PortableTextContentProps = Omit<ComponentProps<typeof PortableTextContent>, "value">;

export function LocalizedPortableTextContent({
	language,
	value,
	...props
}: PortableTextContentProps & {
	readonly language: string | null | undefined;
	readonly value: PortableTextValue;
}) {
	const displayedValue = useChinesePortableText(value, language);
	const renderedLocale = useRenderedContentLocale(language);
	return (
		<div lang={renderedLocale}>
			<PortableTextContent {...props} value={displayedValue} />
		</div>
	);
}
