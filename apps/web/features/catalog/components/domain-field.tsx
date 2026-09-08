"use client";
import { Input, Textarea, Field, FieldLabel } from "@rezics/ui";
import { useId } from "react";

export function DomainField({
	label,
	value,
	onChange,
	multiline = false,
	numeric = false,
	disabled = false,
}: {
	label: string;
	value: string | number | null;
	onChange: (value: string) => void;
	multiline?: boolean;
	numeric?: boolean;
	disabled?: boolean;
}) {
	const id = useId();
	return (
		<Field disabled={disabled}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{multiline ? (
				<Textarea
					id={id}
					value={value ?? ""}
					onChange={(event) => onChange(event.target.value)}
					disabled={disabled}
				/>
			) : (
				<Input
					id={id}
					type={numeric ? "number" : "text"}
					value={value ?? ""}
					onChange={(event) => onChange(event.target.value)}
					disabled={disabled}
				/>
			)}
		</Field>
	);
}
export const optionalText = (value: string) => (value === "" ? null : value);
export const optionalNumber = (value: string) => (value === "" ? null : Number(value));
