import type { ButtonHTMLAttributes, ReactNode } from "react";

export function PickerRow({
  label,
  meta,
  ...rest
}: {
  label: ReactNode;
  meta?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "className">) {
  return (
    <button
      type="button"
      className="flex w-full min-w-0 items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm leading-ui text-text-primary hover:bg-surface-subtle"
      {...rest}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta != null ? (
        <span className="shrink-0 truncate font-mono text-xs text-text-tertiary">
          {meta}
        </span>
      ) : null}
    </button>
  );
}
