import { tv } from "tailwind-variants";

export const quietControlVariants = tv({
	base: [
		"border border-transparent shadow-none",
		"bg-transparent hover:bg-surface-hover dark:bg-transparent dark:hover:bg-surface-hover",
		"transition-[background-color,color,box-shadow]",
		"focus-visible:border-transparent",
		"active:bg-surface-selected dark:active:bg-surface-selected",
		"data-[state=open]:border-transparent data-[state=open]:bg-surface-selected",
		"dark:data-[state=open]:bg-surface-selected",
	],
});
