"use client";

import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldRequiredIndicator,
	Input,
	PasswordInput,
	PasswordInputGroup,
	PasswordInputInput,
	PasswordInputTrigger,
	type InputProps,
} from "@rezics/ui";
import { useId, useState, type FocusEventHandler } from "react";

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
			{description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
		</Field>
	);
}

type AuthPasswordFieldProps = {
	autoComplete: "current-password" | "new-password";
	description?: string;
	error?: string;
	label: string;
	minLength?: number;
	name: string;
	onBlur?: FocusEventHandler<HTMLInputElement>;
	visibilityLabel: (visible: boolean) => string;
};

export function AuthPasswordField({
	autoComplete,
	description,
	error,
	label,
	minLength,
	name,
	onBlur,
	visibilityLabel,
}: AuthPasswordFieldProps) {
	const id = useId();
	const descriptionId = description ? `${id}-description` : undefined;
	const errorId = error ? `${id}-error` : undefined;
	const descriptionReferences = [descriptionId, errorId].filter(Boolean).join(" ");
	const [visible, setVisible] = useState(false);

	return (
		<Field invalid={Boolean(error)} required>
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
						aria-describedby={descriptionReferences || undefined}
						aria-invalid={error ? true : undefined}
						autoCapitalize="none"
						minLength={minLength}
						onBlur={onBlur}
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
			{description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
			{error ? <FieldError id={errorId}>{error}</FieldError> : null}
		</Field>
	);
}
