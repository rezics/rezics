import type { ComponentProps } from "react";

import {
	MenuContent as SharkMenuContent,
	MenuSeparator as SharkMenuSeparator,
	MenuSubContent as SharkMenuSubContent,
} from "../ui/menu";
import { cn } from "../utils";

export {
	Menu,
	MenuArrow,
	MenuCheckboxItem,
	MenuGroup,
	MenuGroupLabel,
	MenuItem,
	MenuPositioner,
	MenuQuickItem,
	MenuRadioGroup,
	MenuRadioItem,
	MenuShortcut,
	MenuSub,
	MenuSubTrigger,
	MenuTrigger,
	menuContentVariants,
	useMenu,
} from "../ui/menu";

export function MenuContent({ className, ...props }: ComponentProps<typeof SharkMenuContent>) {
	return <SharkMenuContent className={cn("border-transparent", className)} {...props} />;
}

export function MenuSubContent({
	className,
	...props
}: ComponentProps<typeof SharkMenuSubContent>) {
	return <SharkMenuSubContent className={cn("border-transparent", className)} {...props} />;
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof SharkMenuSeparator>) {
	return <SharkMenuSeparator className={cn("bg-border-weak", className)} {...props} />;
}
