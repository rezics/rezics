import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { ChangeEvent, FC } from "react";

interface TrustedEmailFieldProps {
  value: string;
  locked: boolean;
  required?: boolean;
  label?: string;
  lockedHelperText: string;
  editableHelperText: string;
  onChange: (value: string) => void;
  onUnlock: () => void;
}

export const TrustedEmailField: FC<TrustedEmailFieldProps> = ({
  value,
  locked,
  required = true,
  label = "Email",
  lockedHelperText,
  editableHelperText,
  onChange,
  onUnlock,
}) => {
  return (
    <Stack spacing={1}>
      <TextField
        name="email"
        type="email"
        label={label}
        variant="standard"
        required={required}
        disabled={locked}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
        helperText={locked ? lockedHelperText : editableHelperText}
      />
      {locked ? (
        <div>
          <Button variant="text" onClick={onUnlock}>
            Edit Email
          </Button>
        </div>
      ) : null}
    </Stack>
  );
};
