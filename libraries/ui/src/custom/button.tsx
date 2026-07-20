import { Button as SharkButton, type ButtonProps as SharkButtonProps } from "../ui/button";
import { cn } from "../utils";

type SharkButtonVariant = NonNullable<SharkButtonProps["variant"]>;

export interface ButtonProps extends Omit<SharkButtonProps, "variant"> {
	/** Use `brand` only for explicit primary actions such as authentication. */
	variant?: SharkButtonVariant | "brand";
}

const neutralButtonClassName = [
	"bg-gradient-to-b from-[#292d30] to-[#0d0f10]",
	"border-black/70 text-white shadow-black/18",
	"hover:from-[#353a3e] hover:to-[#17191b]",
	"dark:border-white/80 dark:from-white dark:to-[#dce2e5] dark:text-[#0d0f10]",
	"dark:hover:from-white dark:hover:to-white",
].join(" ");

const brandButtonClassName = "border-transparent bg-primary text-white hover:bg-primary/90";

export function Button({ variant = "default", className, ...props }: ButtonProps) {
	const sharkVariant = variant === "brand" ? "default" : variant;
	const policyClassName =
		variant === "brand"
			? brandButtonClassName
			: variant === "default"
				? neutralButtonClassName
				: undefined;

	return (
		<SharkButton {...props} className={cn(policyClassName, className)} variant={sharkVariant} />
	);
}

export { buttonVariants } from "../ui/button";
