import {
	Button as SharkButton,
	type ButtonProps as SharkButtonProps,
	buttonVariants as sharkButtonVariants,
} from "../ui/button";
import { cn } from "../utils";
import { quietControlVariants } from "./control-surface";

type SharkButtonVariant = NonNullable<SharkButtonProps["variant"]>;
export type ButtonVariant =
	Exclude<SharkButtonVariant, "default" | "ghost"> | "brand" | "quiet" | "solid";

export interface ButtonProps extends Omit<SharkButtonProps, "variant"> {
	/**
	 * Project visual policy: controls are `quiet` by default. Filled actions must explicitly use
	 * `solid`, `brand`, `secondary`, or `destructive`.
	 */
	variant?: ButtonVariant;
}

export interface ButtonStyleProps {
	className?: string;
	clickEffect?: SharkButtonProps["clickEffect"];
	pill?: SharkButtonProps["pill"];
	size?: SharkButtonProps["size"];
	variant?: ButtonVariant;
}

const neutralButtonClassName = [
	"bg-gradient-to-b from-[#292d30] to-[#0d0f10]",
	"border-black/70 text-white shadow-black/18",
	"hover:from-[#353a3e] hover:to-[#17191b]",
	"dark:border-white/80 dark:from-white dark:to-[#dce2e5] dark:text-[#0d0f10]",
	"dark:hover:from-white dark:hover:to-white",
].join(" ");

const brandButtonClassName = "border-transparent bg-primary text-white! hover:bg-primary/90";

function resolveButtonPolicy(variant: ButtonVariant): {
	className?: string;
	sharkVariant: SharkButtonVariant;
} {
	switch (variant) {
		case "brand":
			return { className: brandButtonClassName, sharkVariant: "default" };
		case "solid":
			return { className: neutralButtonClassName, sharkVariant: "default" };
		case "quiet":
			return {
				className: quietControlVariants(),
				sharkVariant: "ghost",
			};
		default:
			return { sharkVariant: variant };
	}
}

export function buttonVariants({
	className,
	clickEffect,
	pill,
	size,
	variant = "quiet",
}: ButtonStyleProps = {}) {
	const policy = resolveButtonPolicy(variant);
	return cn(
		sharkButtonVariants({ clickEffect, pill, size, variant: policy.sharkVariant }),
		policy.className,
		className,
	);
}

export function Button({ variant = "quiet", className, ...props }: ButtonProps) {
	const policy = resolveButtonPolicy(variant);

	return (
		<SharkButton
			{...props}
			className={cn(policy.className, className)}
			variant={policy.sharkVariant}
		/>
	);
}
