"use client";

import { useListCollection } from "@ark-ui/react";
import { useEffect, type ComponentProps, type ReactNode } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { cn } from "../utils";
import { quietControlVariants } from "./control-surface";

export interface ChoiceOption<Value extends string> {
	readonly value: Value;
	readonly label: string;
	readonly description?: string;
	readonly icon?: ReactNode;
}

/**
 * `quiet` is the default and stays transparent until interaction. `field` explicitly preserves
 * a form boundary.
 */
export type ChoiceSelectAppearance = "field" | "quiet";
export type ChoiceSelectSize = NonNullable<ComponentProps<typeof SelectTrigger>["size"]>;

const choiceSelectAppearanceClassNames = {
	field: "border-input bg-background shadow-sm/5",
	quiet: quietControlVariants(),
} as const satisfies Record<ChoiceSelectAppearance, string>;

function isChoiceValue<Value extends string>(
	options: readonly ChoiceOption<Value>[],
	value: string,
): value is Value {
	return options.some((option) => option.value === value);
}

export function ChoiceSelect<Value extends string>({
	appearance = "quiet",
	ariaLabel,
	className,
	contentClassName,
	multiple = false,
	name,
	onValueChange,
	options,
	placeholder,
	size = "md",
	triggerIcon,
	value,
}: {
	appearance?: ChoiceSelectAppearance;
	ariaLabel: string;
	className?: string;
	contentClassName?: string;
	multiple?: boolean;
	name?: string;
	onValueChange: (value: readonly Value[]) => void;
	options: readonly ChoiceOption<Value>[];
	placeholder: string;
	size?: ChoiceSelectSize;
	triggerIcon?: ReactNode;
	value: readonly Value[];
}) {
	const { collection, set } = useListCollection<ChoiceOption<Value>>({
		initialItems: [...options],
		itemToString: (item) => item.label,
		itemToValue: (item) => item.value,
	});
	const optionsKey = options
		.map((option) => `${option.value}\u0000${option.label}\u0000${option.description ?? ""}`)
		.join("\u0001");
	useEffect(() => set([...options]), [optionsKey, set]);
	const selectedLabels = value.flatMap((selected) => {
		const option = options.find((candidate) => candidate.value === selected);
		return option ? [option.label] : [];
	});

	return (
		<Select
			collection={collection}
			multiple={multiple}
			name={name}
			onValueChange={({ value: nextValue }) => {
				onValueChange(nextValue.filter((candidate) => isChoiceValue(options, candidate)));
			}}
			value={[...value]}
		>
			<SelectTrigger
				aria-label={ariaLabel}
				className={cn("min-w-32", choiceSelectAppearanceClassNames[appearance], className)}
				size={size}
			>
				{triggerIcon}
				<span
					className={cn(
						"min-w-0 truncate",
						!selectedLabels.length && "text-muted-foreground",
					)}
				>
					{selectedLabels.length ? selectedLabels.join(", ") : placeholder}
				</span>
			</SelectTrigger>
			<SelectContent className={cn("min-w-64 border-transparent p-1.5", contentClassName)}>
				{options.map((option) => (
					<SelectItem className="items-start py-2.5" item={option} key={option.value}>
						{option.icon}
						<span className="grid gap-0.5">
							<span className="font-semibold">{option.label}</span>
							{option.description ? (
								<span className="text-muted-foreground text-xs leading-5">
									{option.description}
								</span>
							) : null}
						</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
