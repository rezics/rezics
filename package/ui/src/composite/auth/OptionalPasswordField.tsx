import { Typography } from "@mui/material";
import type { FC } from "react";
import { PasswordField } from "../form/field/PasswordField";

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
        <Typography variant="body2" color="text.secondary">
          {note}
        </Typography>
      ) : null}
    </>
  );
};
