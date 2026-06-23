"use client";


// Placeholder that renders a textarea until PT editor is integrated
// PT 编辑器集成前的占位 textarea
import { useCallback, useState, type ChangeEvent } from "react";

export { PortableTextEditorComponent as PortableTextEditor };

export function PortableTextEditorComponent({
  value: controlledValue,
  onChange,
}: {
  readonly value?: string;
  readonly onChange?: (value: string) => void;
} = {}) {
  const [internal, setInternal] = useState("");
  const value = controlledValue ?? internal;

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      setInternal(v);
      onChange?.(v);
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
