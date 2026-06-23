import type { ReactNode } from "react";

export default function EditorLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col px-4 py-6">
      {children}
    </div>
  );
}
