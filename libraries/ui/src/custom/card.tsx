import type { ComponentProps } from "react";

import {
	Card as SharkCard,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardMedia,
	CardTitle,
} from "../ui/card";
import { cn } from "../utils";

export type CardAppearance = "elevated" | "ghost" | "outlined";

const cardAppearanceClassNames = {
	elevated: "border-transparent bg-card shadow-lg/10",
	ghost: "border-transparent bg-transparent shadow-none",
	outlined: "border-border-weak bg-card shadow-none",
} as const satisfies Record<CardAppearance, string>;

export interface CardProps extends ComponentProps<typeof SharkCard> {
	/** Static cards are borderless by default; framing and elevation must be intentional. */
	appearance?: CardAppearance;
}

export function Card({ appearance = "ghost", className, ...props }: CardProps) {
	return (
		<SharkCard
			{...props}
			className={cn(cardAppearanceClassNames[appearance], className)}
			data-appearance={appearance}
		/>
	);
}

export { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardMedia, CardTitle };
