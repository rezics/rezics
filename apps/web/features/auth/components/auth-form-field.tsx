"use client";

import {
	Field,
	FieldDescription,
	FieldLabel,
	FieldRequiredIndicator,
	Input,
	PasswordInput,
	PasswordInputGroup,
	PasswordInputInput,
	PasswordInputTrigger,
	type InputProps,
} from "@rezics/ui";
import { useId, useState } from "react";

type AuthTextFieldProps = Omit<InputProps, "name" | "required" | "size"> & {
	description?: string;
	label: string;
	name: string;
};

export function AuthTextField({
	"aria-describedby": ariaDescribedBy,
	description,
	id: providedId,
	label,
	name,
	...inputProps
}: AuthTextFieldProps) {
	const generatedId = useId();
	const id = providedId ?? generatedId;
	const descriptionId = description ? `${id}-description` : undefined;
	const descriptionReferences = [ariaDescribedBy, descriptionId].filter(Boolean).join(" ");

	return (
		<Field required>
			<FieldLabel htmlFor={id}>
				{label}
				<FieldRequiredIndicator />
			</FieldLabel>
			<Input
				{...inputProps}
				aria-describedby={descriptionReferences || undefined}
				id={id}
				name={name}
				required
				size="lg"
			/>
			{description ? (
				<FieldDescription id={descriptionId}>{description}</FieldDescription>
			) : null}
		</Field>
	);
}

type AuthPasswordFieldProps = {
	autoComplete: "current-password" | "new-password";
	description?: string;
	label: string;
	minLength: number;
	name: string;
	visibilityLabel: (visible: boolean) => string;
};

export function AuthPasswordField({
	autoComplete,
	description,
	label,
	minLength,
	name,
	visibilityLabel,
}: AuthPasswordFieldProps) {
	const id = useId();
	const descriptionId = description ? `${id}-description` : undefined;
	const [visible, setVisible] = useState(false);

	return (
		<Field required>
			<FieldLabel htmlFor={id}>
				{label}
				<FieldRequiredIndicator />
			</FieldLabel>
			<PasswordInput
				autoComplete={autoComplete}
				ids={{ input: id }}
				name={name}
				onVisibilityChange={({ visible: nextVisible }) => setVisible(nextVisible)}
				required
				size="lg"
				translations={{ visibilityTrigger: visibilityLabel }}
				visible={visible}
			>
				<PasswordInputGroup>
					<PasswordInputInput
						aria-describedby={descriptionId}
						autoCapitalize="none"
						minLength={minLength}
						spellCheck={false}
					/>
					<PasswordInputTrigger
						onClick={(event) => {
							if (event.detail === 0) setVisible((current) => !current);
						}}
						tabIndex={0}
					/>
				</PasswordInputGroup>
			</PasswordInput>
			{description ? (
				<FieldDescription id={descriptionId}>{description}</FieldDescription>
			) : null}
		</Field>
	);
}
