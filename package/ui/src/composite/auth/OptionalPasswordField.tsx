import type { FC } from "react";
import { PasswordField } from "../forms/field/PasswordField";

interface OptionalPasswordFieldProps {
  value: string;
  setValue: (value: string) => void;
  helperText?: string;
  note?: string;
}

export const OptionalPasswordField: FC<OptionalPasswordFieldProps> = ({
  value,
  setValue,
  helperText = "Leave blank if you do not want to set a password yet.",
  note,
}) => {
  return (
    <>
      <PasswordField
        value={value}
        setValue={setValue}
        required={false}
        helperText={helperText}
      />
      {note ? (
        <p className="text-sm text-rezics-fg-muted">{note}</p>
      ) : null}
    </>
  );
};
