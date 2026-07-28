import type { ComponentProps } from "react";

import { cn } from "../utils";
import { Card, type CardAppearance } from "./card";

export interface ContentCardProps extends ComponentProps<"article"> {
	appearance?: CardAppearance;
}

/**
 * Shared content-stream card chrome.
 *
 * Feature owners compose their own headers, content, and optional footers so
 * management surfaces do not inherit Feed interactions.
 */
export function ContentCard({ appearance = "ghost", className, ...props }: ContentCardProps) {
	return (
		<Card
			appearance={appearance}
			asChild
			className={cn(
				"gap-0 rounded-none py-0 sm:rounded-2xl",
				"transition-colors hover:bg-surface-hover focus-within:bg-surface-hover",
				className,
			)}
		>
			<article data-slot="content-card" {...props} />
		</Card>
	);
}
