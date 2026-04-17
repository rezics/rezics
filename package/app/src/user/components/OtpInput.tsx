import { TextField } from "@mui/material";
import {
  type ClipboardEvent,
  type FC,
  type KeyboardEvent,
  useCallback,
  useRef,
} from "react";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const OtpInput: FC<OtpInputProps> = ({
  length = 6,
  value,
  onChange,
  disabled = false,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const focusInput = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, length - 1));
      inputRefs.current[clamped]?.focus();
    },
    [length],
  );

  const handleChange = useCallback(
    (index: number, char: string) => {
      if (!/^\d$/.test(char)) return;
      const next = digits.slice();
      next[index] = char;
      onChange(next.join(""));
      if (index < length - 1) {
        focusInput(index + 1);
      }
    },
    [digits, onChange, length, focusInput],
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        const next = digits.slice();
        if (next[index]) {
          next[index] = "";
          onChange(next.join(""));
        } else if (index > 0) {
          next[index - 1] = "";
          onChange(next.join(""));
          focusInput(index - 1);
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        focusInput(index - 1);
      } else if (e.key === "ArrowRight" && index < length - 1) {
        focusInput(index + 1);
      }
    },
    [digits, onChange, length, focusInput],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
      if (pasted.length > 0) {
        onChange(pasted.padEnd(length, "").slice(0, length));
        focusInput(Math.min(pasted.length, length - 1));
      }
    },
    [onChange, length, focusInput],
  );

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((digit, i) => (
        <TextField
          key={i}
          inputRef={(el: HTMLInputElement | null) => {
            inputRefs.current[i] = el;
          }}
          value={digit || ""}
          onChange={(e) => {
            const char = e.target.value.slice(-1);
            handleChange(i, char);
          }}
          onKeyDown={(e) =>
            handleKeyDown(i, e as KeyboardEvent<HTMLInputElement>)
          }
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          slotProps={{
            input: {
              style: {
                width: "48px",
                height: "56px",
                padding: 0,
              },
            },
            htmlInput: {
              maxLength: 1,
              inputMode: "numeric",
              pattern: "[0-9]",
              autoComplete: "one-time-code",
              style: {
                textAlign: "center",
                fontSize: "24px",
                fontFamily: "monospace",
                fontWeight: 700,
              },
            },
          }}
          variant="outlined"
        />
      ))}
    </div>
  );
};
