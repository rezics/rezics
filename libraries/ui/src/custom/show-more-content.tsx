"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { cn } from "../utils";
import { Button } from "./button";

export function ShowMoreContent({
	children,
	className,
	contentClassName,
	collapsedClassName = "max-h-32",
	showLessLabel,
	showMoreLabel,
}: {
	children: ReactNode;
	className?: string;
	contentClassName?: string;
	collapsedClassName?: string;
	showLessLabel: string;
	showMoreLabel: string;
}) {
	const contentId = useId();
	const contentRef = useRef<HTMLDivElement>(null);
	const [isExpanded, setIsExpanded] = useState(false);
	const [hasOverflow, setHasOverflow] = useState(false);

	useEffect(() => {
		if (isExpanded) return;

		const content = contentRef.current;
		if (!content) return;

		const measureOverflow = () => {
			setHasOverflow(content.scrollHeight > content.clientHeight + 1);
		};

		measureOverflow();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measureOverflow);
		observer.observe(content);
		return () => observer.disconnect();
	}, [isExpanded]);

	return (
		<div className={cn("min-w-0", className)} data-slot="show-more-content">
			<div className="relative">
				<div
					className={cn(
						"overflow-hidden",
						isExpanded ? "max-h-none" : collapsedClassName,
						contentClassName,
					)}
					id={contentId}
					ref={contentRef}
				>
					{children}
				</div>
				{hasOverflow && !isExpanded ? (
					<div
						aria-hidden
						className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-b from-transparent to-background"
					/>
				) : null}
			</div>
			{hasOverflow ? (
				<Button
					aria-controls={contentId}
					aria-expanded={isExpanded}
					className="mt-3 justify-start px-0 font-semibold underline-offset-4 hover:bg-transparent hover:text-foreground hover:underline"
					clickEffect={false}
					onClick={() => setIsExpanded((current) => !current)}
					size="md"
					variant="quiet"
				>
					{isExpanded ? showLessLabel : showMoreLabel}
					<ChevronDown
						aria-hidden
						className={cn(
							"size-4 transition-transform duration-200 motion-reduce:transition-none",
							isExpanded && "rotate-180",
						)}
					/>
				</Button>
			) : null}
		</div>
	);
}
