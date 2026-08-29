import { Button, type ButtonProps } from "@rezics/ui/ui/button";
import { Kbd } from "@rezics/ui/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@rezics/ui/ui/tooltip";
import type { ReactElement, ReactNode } from "react";

export function TooltipButton({
	label,
	shortcut,
	children,
	...buttonProps
}: Omit<ButtonProps, "aria-label"> & {
	readonly label: string;
	readonly shortcut?: string;
	readonly children: ReactNode;
}): ReactElement {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button aria-label={label} {...buttonProps}>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent className="flex items-center gap-2">
				<span>{label}</span>
				{shortcut ? <Kbd>{shortcut}</Kbd> : null}
			</TooltipContent>
		</Tooltip>
	);
}
