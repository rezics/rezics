"use client";
import { useId } from "react";
import {
	Checkbox,
	Field,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	Textarea,
} from "@rezics/ui";
export function DefinitionText({
	label,
	value,
	onChange,
	multiline = false,
	required = false,
	disabled = false,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	multiline?: boolean;
	required?: boolean;
	disabled?: boolean;
}) {
	const id = useId();
	return (
		<Field required={required} disabled={disabled}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{multiline ? (
				<Textarea
					id={id}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					required={required}
					disabled={disabled}
				/>
			) : (
				<Input
					id={id}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					required={required}
					disabled={disabled}
				/>
			)}
		</Field>
	);
}
export function DefinitionChoice<Value extends string>({
	label,
	value,
	values,
	labelFor,
	onChange,
	disabled = false,
}: {
	label: string;
	value: Value;
	values: readonly Value[];
	labelFor: (value: Value) => string;
	onChange: (value: Value) => void;
	disabled?: boolean;
}) {
	const id = useId();
	return (
		<Field disabled={disabled}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<NativeSelect
				id={id}
				value={value}
				disabled={disabled}
				onChange={(event) => {
					const selected = values.find((item) => item === event.target.value);
					if (selected !== undefined) onChange(selected);
				}}
			>
				{values.map((item) => (
					<NativeSelectOption key={item} value={item}>
						{labelFor(item)}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
export function DefinitionFlag({
	label,
	value,
	onChange,
}: {
	label: string;
	value: boolean;
	onChange: (value: boolean) => void;
}) {
	const id = useId();
	return (
		<Field orientation="horizontal">
			<Checkbox
				checked={value}
				ids={{ hiddenInput: id }}
				onCheckedChange={(detail) => onChange(detail.checked === true)}
			/>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
		</Field>
	);
}
export function DefinitionNumber({
	label,
	value,
	onChange,
	min,
	max,
	integer = false,
}: {
	label: string;
	value: number | undefined;
	onChange: (value: number | undefined) => void;
	min?: number;
	max?: number;
	integer?: boolean;
}) {
	const id = useId();
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				id={id}
				type="number"
				min={min}
				max={max}
				step={integer ? 1 : "any"}
				value={value ?? ""}
				onChange={(event) => {
					const raw = event.target.value;
					if (!raw) {
						onChange(undefined);
						return;
					}
					const next = Number(raw);
					if (
						Number.isFinite(next) &&
						(!integer || Number.isSafeInteger(next)) &&
						(min === undefined || next >= min) &&
						(max === undefined || next <= max)
					)
						onChange(next);
				}}
			/>
		</Field>
	);
}
