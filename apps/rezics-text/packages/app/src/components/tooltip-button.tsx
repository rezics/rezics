import { Button, type ButtonProps } from "@rezics/ui/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@rezics/ui/ui/tooltip";
import type { ReactElement, ReactNode } from "react";

export function TooltipButton({
	label,
	children,
	...buttonProps
}: Omit<ButtonProps, "aria-label"> & {
	readonly label: string;
	readonly children: ReactNode;
}): ReactElement {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button aria-label={label} {...buttonProps}>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}
