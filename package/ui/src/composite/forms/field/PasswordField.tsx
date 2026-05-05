import { Eye as Visibility, EyeOff as VisibilityOff } from "lucide-react";
import React, { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shadcn/button";
import { Input } from "@/shadcn/input";
import { Label } from "@/shadcn/label";

interface PasswordFieldProps {
  name?: string;
  label?: string;
  value: string;
  /** Accepted for source-level compatibility with legacy callers — not rendered. */
  variant?: "standard" | "outlined" | "filled";
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  setValue: (value: string) => void;
  helperText?: string;
  required?: boolean;
  className?: string;
}

export const PasswordField: FC<PasswordFieldProps> = ({
  name,
  label,
  value,
  setValue,
  helperText,
  className,
  required = true,
}) => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  const inputName = name ?? "password";
  const help = helperText ?? t("auth.help.password_require");
  const labelText = label ?? t("common.password");

  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <Label htmlFor={inputName} className="text-sm text-rezics-fg-muted">
        {labelText}
        {required ? <span aria-hidden="true"> *</span> : null}
      </Label>
      <div className="relative">
        <Input
          id={inputName}
          name={inputName}
          type={showPassword ? "text" : "password"}
          required={required}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={
            showPassword ? "hide the password" : "display the password"
          }
          onClick={() => setShowPassword(!showPassword)}
          onMouseDown={(e) => e.preventDefault()}
          onMouseUp={(e) => e.preventDefault()}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
        >
          {showPassword ? (
            <VisibilityOff className="size-4" />
          ) : (
            <Visibility className="size-4" />
          )}
        </Button>
      </div>
      {help ? <p className="text-xs text-rezics-fg-muted">{help}</p> : null}
    </div>
  );
};
