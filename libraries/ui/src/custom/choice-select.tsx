"use client";

import { useListCollection } from "@ark-ui/react";
import { useEffect, type ReactNode } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { cn } from "../utils";

export interface ChoiceOption<Value extends string> {
	readonly value: Value;
	readonly label: string;
	readonly description?: string;
	readonly icon?: ReactNode;
}

function isChoiceValue<Value extends string>(
	options: readonly ChoiceOption<Value>[],
	value: string,
): value is Value {
	return options.some((option) => option.value === value);
}

export function ChoiceSelect<Value extends string>({
	ariaLabel,
	className,
	contentClassName,
	multiple = false,
	name,
	onValueChange,
	options,
	placeholder,
	triggerIcon,
	value,
}: {
	ariaLabel: string;
	className?: string;
	contentClassName?: string;
	multiple?: boolean;
	name?: string;
	onValueChange: (value: readonly Value[]) => void;
	options: readonly ChoiceOption<Value>[];
	placeholder: string;
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
				className={cn(
					"h-10 min-w-32 rounded-xl border-border bg-background px-3.5 font-semibold shadow-sm/5",
					className,
				)}
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
			<SelectContent className={cn("min-w-64 p-1.5", contentClassName)}>
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
