import type { ReactNode } from "react";

export interface EditorPanelProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function EditorPanel({ left, right, className }: EditorPanelProps) {
  return (
    <div
      className={[
        "flex items-center gap-1 px-2 min-h-[36px]",
        className ?? "",
      ].join(" ")}
    >
      {left && (
        <div className="flex items-center gap-1 shrink-0">{left}</div>
      )}
      <div className="flex-1" />
      {right && <div className="flex items-center gap-1">{right}</div>}
    </div>
  );
}
