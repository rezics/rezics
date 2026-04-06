import { AppShell } from "@rezics/app-shell";
import type React from "react";
export default function GlobalDecorator({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
