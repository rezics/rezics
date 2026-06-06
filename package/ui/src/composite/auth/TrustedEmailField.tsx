import type { ChangeEvent, FC } from "react";
import { Button } from "#/shadcn/button";
import { Input } from "#/shadcn/input";
import { Label } from "#/shadcn/label";

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
    <div className="flex flex-col gap-2">
      <Label htmlFor="email" className="text-sm text-rezics-fg-muted">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </Label>
      <Input
        id="email"
        name="email"
        type="email"
        required={required}
        disabled={locked}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
      />
      <p className="text-xs text-rezics-fg-muted">
        {locked ? lockedHelperText : editableHelperText}
      </p>
      {locked ? (
        <div>
          <Button type="button" variant="ghost" onClick={onUnlock}>
            Edit Email
          </Button>
        </div>
      ) : null}
    </div>
  );
};
