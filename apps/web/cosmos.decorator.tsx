import type { ReactNode } from "react";

import { appThemeCss } from "@/lib/theme";

export default function CosmosDecorator({ children }: { children: ReactNode }) {
	return (
		<>
			<style>{appThemeCss}</style>
			{children}
		</>
	);
}
