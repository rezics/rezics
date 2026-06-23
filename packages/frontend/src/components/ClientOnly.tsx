"use client";

import { type ReactNode, useEffect, useState } from "react";

// SSR guard: renders children only after client-side mount
// SSR 守卫：仅在客户端挂载后渲染子节点
export function ClientOnly({ children }: { readonly children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : null;
}
