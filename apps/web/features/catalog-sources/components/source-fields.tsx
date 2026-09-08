"use client";
import { useId } from "react";
import { Field, FieldLabel, Input, Textarea, NativeSelect, NativeSelectOption } from "@rezics/ui";
export function SourceText({
	label,
	value,
	onChange,
	multiline = false,
	required = false,
	maxLength = multiline ? 2048 : 512,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	multiline?: boolean;
	required?: boolean;
	maxLength?: number;
}) {
	const id = useId();
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{multiline ? (
				<Textarea
					id={id}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					required={required}
					maxLength={maxLength}
				/>
			) : (
				<Input
					id={id}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					required={required}
					maxLength={maxLength}
				/>
			)}
		</Field>
	);
}
export function SourceChoice<Value extends string>({
	label,
	value,
	values,
	labelFor,
	onChange,
}: {
	label: string;
	value: Value;
	values: readonly Value[];
	labelFor: (value: Value) => string;
	onChange: (value: Value) => void;
}) {
	const id = useId();
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<NativeSelect
				id={id}
				value={value}
				onChange={(event) => {
					const selected = values.find((item) => item === event.target.value);
					if (selected) onChange(selected);
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
