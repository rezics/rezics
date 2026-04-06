import { Rating, type RatingProps, TextField } from "@mui/material";
import type React from "react";
import { useEffect, useState } from "react";

type RatingWithInputProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  max?: number;
  precision?: number;
  size?: "small" | "medium" | "large";
  name?: string;
  disabled?: boolean;
} & Omit<
  RatingProps,
  "value" | "onChange" | "max" | "precision" | "size" | "name" | "disabled"
>;

export function RatingWithInput({
  value,
  onChange,
  max = 10,
  precision = 0.5,
  size = "large",
  name = "score-rating",
  disabled = false,
  ...rest
}: RatingWithInputProps) {
  // 内部临时输入状态
  const [inputValue, setInputValue] = useState<string>(String(value ?? ""));

  // 当外部 value 变化时，同步更新输入框
  useEffect(() => {
    setInputValue(String(value ?? ""));
  }, [value]);

  const handleRatingChange = (
    _event: React.SyntheticEvent,
    newValue: number | null,
  ) => {
    const finalValue = newValue ?? 0;
    setInputValue(String(finalValue));
    onChange(finalValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    // 允许：空、整数、小数但最多一位，例如 "7", "7.", "7.3"
    const maxDigits = String(max).length;
    const pattern = new RegExp(`^\\d{0,${maxDigits}}(\\.\\d?)?$`);

    if (pattern.test(val)) {
      setInputValue(val);

      // 如果是有效数字，立即更新外部值
      const numValue = parseFloat(val);
      if (!Number.isNaN(numValue) && numValue >= 0 && numValue <= max) {
        onChange(numValue);
      } else if (val === "") {
        onChange(null);
      }
    }
  };

  const handleInputBlur = () => {
    let finalValue = inputValue;

    // 失焦时自动修正，例如 "7." -> "7"
    if (finalValue.endsWith(".")) {
      finalValue = finalValue.slice(0, -1);
    }

    // 如果是空字符串，设置为 null
    if (finalValue === "") {
      setInputValue("");
      onChange(null);
      return;
    }

    // 验证并限制范围
    let numValue = parseFloat(finalValue);
    if (Number.isNaN(numValue)) {
      numValue = value ?? 0;
    } else {
      numValue = Math.max(0, Math.min(max, numValue));
    }

    setInputValue(String(numValue));
    onChange(numValue);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      <Rating
        name={name}
        size={size}
        value={value ?? 0}
        precision={precision}
        max={max}
        disabled={disabled}
        onChange={handleRatingChange}
        {...rest}
      />
      <TextField
        variant="standard"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        disabled={disabled}
        inputProps={{
          style: { width: "60px", textAlign: "center" },
        }}
      />
    </div>
  );
}
