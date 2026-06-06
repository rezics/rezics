import type React from "react";
import { createContext, useContext, useMemo, useState } from "react";

type ThreadingHoverContextValue = {
  hovered: boolean;
  setHovered: (next: boolean) => void;
};

const ThreadingHoverContext = createContext<ThreadingHoverContextValue | null>(
  null,
);

export function ThreadingHoverProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const value = useMemo(() => ({ hovered, setHovered }), [hovered]);
  return (
    <ThreadingHoverContext.Provider value={value}>
      {children}
    </ThreadingHoverContext.Provider>
  );
}

export function useThreadingHover(): ThreadingHoverContextValue {
  const value = useContext(ThreadingHoverContext);
  if (!value) return { hovered: false, setHovered: () => {} };
  return value;
}
