import type { ComponentProps } from "react";
import { NativeSelect as SharkNativeSelect } from "../ui/native-select";
import { cn } from "../utils";

/** Keeps empty-value labels readable on REZICS surfaces, including optional form values. */
export function NativeSelect({ className, ...props }: ComponentProps<typeof SharkNativeSelect>) {
	return (
		<SharkNativeSelect
			{...props}
			className={cn("[&_select:has(option[value='']:checked)]:text-muted-foreground", className)}
		/>
	);
}
