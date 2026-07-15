import type { ReactNode } from "react";

import { ApplicationShell } from "./app-shell";

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
	return <ApplicationShell>{children}</ApplicationShell>;
}
