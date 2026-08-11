"use client";

import type { ComponentProps, ReactNode } from "react";

import { Card } from "./card";
import { Cover } from "./cover";
import { cn } from "../utils";

export interface UnitCardProps extends Omit<ComponentProps<"a">, "children" | "href" | "title"> {
	cover?: { url: string } | null;
	description?: string | null;
	fallback?: ReactNode;
	headingAs?: "h2" | "h3";
	href: string;
	sizes?: string;
	title: string;
}

/**
 * A ghost portrait card whose complete visual surface is one native link.
 * Keep secondary actions outside this component so links never contain nested controls.
 */
export function UnitCard({
	"aria-label": ariaLabel,
	className,
	cover,
	description,
	fallback,
	headingAs: Heading = "h2",
	href,
	sizes = "(min-width: 1024px) 176px, (min-width: 640px) 28vw, 44vw",
	title,
	...linkProps
}: UnitCardProps) {
	return (
		<Card
			appearance="ghost"
			asChild
			className={cn(
				"group min-w-0 gap-0 overflow-visible p-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/32",
				className,
			)}
		>
			<a aria-label={ariaLabel ?? title} href={href} {...linkProps}>
				<Cover
					alt=""
					aria-hidden
					className="rounded-xl border border-border-weak shadow-sm/5 transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none"
					fallback={fallback}
					sizes={sizes}
					src={cover?.url}
				/>
				<Heading className="mt-2.5 line-clamp-2 font-semibold text-sm leading-5">{title}</Heading>
				{description ? (
					<p className="mt-1 line-clamp-2 text-muted-foreground text-xs leading-5">{description}</p>
				) : null}
			</a>
		</Card>
	);
}
