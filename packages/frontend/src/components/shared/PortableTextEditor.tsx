"use client";

// ponytail: Portable Text editor — wire up when @portabletext/editor API stabilizes
// Placeholder that renders a textarea until PT editor is integrated
import { useCallback, type ChangeEvent } from "react";

export function PortableTextEditorComponent({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <textarea
      className="border-input bg-background ring-ring/20 min-h-[200px] w-full rounded-md border p-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
      onChange={handleChange}
      placeholder="Write something..."
      value={value}
    />
  );
}
