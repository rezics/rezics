import { Visibility, VisibilityOff } from "@mui/icons-material";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import React, { type FC, useState } from "react";
import { useTranslation } from "react-i18next";

interface PasswordFieldProps {
  name?: string;
  label?: string;
  value: string;
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
  variant = "standard",
  helperText,
  className,
  required = true,
}) => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
  };

  const handleMouseUpPassword = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
  };

  return (
    <TextField
      className={className}
      name={name ?? "password"}
      type={showPassword ? "text" : "password"}
      label={label ?? t("common.password")}
      helperText={helperText ?? t("auth.help.password_require")}
      variant={variant}
      required={required}
      value={value}
      onChange={(event: any) => {
        setValue(event.target.value);
      }}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label={
                showPassword ? "hide the password" : "display the password"
              }
              onClick={() => setShowPassword(!showPassword)}
              onMouseDown={handleMouseDownPassword}
              onMouseUp={handleMouseUpPassword}
            >
              {showPassword ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
};
