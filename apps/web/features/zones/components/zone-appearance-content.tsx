import type { ZoneAppearanceDocument } from "@rezics/block";
import { createContext, useContext, type ReactNode } from "react";

import { zoneAppearanceStyle, type ZoneAppearanceStyle } from "../model/zone-appearance-style";

const ZoneAppearanceScopeStyleContext = createContext<ZoneAppearanceStyle | undefined>(undefined);

/** Token values copied onto every Page/Dock scope, including portaled Dock UI. */
export function useZoneAppearanceScopeStyle(): ZoneAppearanceStyle | undefined {
	return useContext(ZoneAppearanceScopeStyleContext);
}

export function ZoneAppearanceContent({
	appearance,
	children,
}: {
	readonly appearance: ZoneAppearanceDocument;
	readonly children: ReactNode;
}) {
	const appearanceStyle = zoneAppearanceStyle(appearance);
	return (
		<ZoneAppearanceScopeStyleContext value={appearanceStyle}>
			<div
				className="min-w-0 flex-1 bg-[var(--rezics-zone-surface-tint)] text-foreground"
				data-zone-appearance-content=""
				data-zone-color-scheme={appearance.colorScheme}
				style={appearanceStyle}
			>
				{children}
			</div>
		</ZoneAppearanceScopeStyleContext>
	);
}
