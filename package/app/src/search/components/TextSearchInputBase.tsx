import { Input } from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";

export type TextSearchInputBaseProps = {
  value: string;
  size?: "small" | "medium";
  height?: number;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  startAdornmentIcon?: React.ReactNode;
};

export const TextSearchInputBase: React.FC<TextSearchInputBaseProps> = ({
  value,
  height,
  onValueChange,
  onSubmit,
  label,
  placeholder,
  className,
  startAdornmentIcon,
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-sm text-text-secondary">
          {label}
        </label>
      )}
      <div
        className="relative flex items-center w-full"
        style={height ? { height: `${height}px` } : undefined}
      >
        {startAdornmentIcon && (
          <div className="absolute left-2 flex items-center pointer-events-none">
            {startAdornmentIcon}
          </div>
        )}
        <Input
          autoComplete="off"
          placeholder={placeholder ?? "Find anything"}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={height ? { height: `${height}px` } : undefined}
          className={startAdornmentIcon ? "pl-10" : ""}
          onKeyDown={(event) => {
            /**
             * 防止中文 / 日文 IME 输入时误触 Enter
             */
            if (event.nativeEvent.isComposing) return;

            /**
             * 仅在 focus 时触发 search
             */
            if (focused && event.key === "Enter") {
              event.preventDefault();
              onSubmit(value);
            }
          }}
        />
      </div>
    </div>
  );
};
