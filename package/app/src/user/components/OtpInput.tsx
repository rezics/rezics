import { Input } from "@rezics/ui/shadcn";
import {
  type ClipboardEvent,
  type FC,
  type KeyboardEvent,
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
  const slots = Array.from({ length }, (_, i) => ({
    key: `otp-slot-${i}`,
    index: i,
    digit: digits[i] ?? "",
  }));

  const focusInput = (index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    inputRefs.current[clamped]?.focus();
  };

  const handleChange = (index: number, char: string) => {
    if (!/^\d$/.test(char)) return;
    const next = digits.slice();
    next[index] = char;
    onChange(next.join(""));
    if (index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
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
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    if (pasted.length > 0) {
      onChange(pasted.padEnd(length, "").slice(0, length));
      focusInput(Math.min(pasted.length, length - 1));
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {slots.map(({ key, index, digit }) => (
        <Input
          key={key}
          ref={(el: HTMLInputElement | null) => {
            inputRefs.current[index] = el;
          }}
          value={digit || ""}
          onChange={(e) => {
            const char = e.target.value.slice(-1);
            handleChange(index, char);
          }}
          onKeyDown={(e) =>
            handleKeyDown(index, e as KeyboardEvent<HTMLInputElement>)
          }
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          maxLength={1}
          inputMode="numeric"
          pattern="[0-9]"
          autoComplete="one-time-code"
          className="w-12 h-14 p-0 text-center text-2xl font-mono font-bold"
        />
      ))}
    </div>
  );
};
