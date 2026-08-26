import type { ZoneThemeDocument } from "@rezics/block";
import { Button } from "@rezics/ui";
import { createContext, useContext, type ReactNode } from "react";

import { useTranslation } from "@/i18n/client";
import { zoneThemeStyle, type ZoneThemeStyle } from "../model/zone-theme-style";

const ZoneThemeScopeStyleContext = createContext<ZoneThemeStyle | undefined>(undefined);

/** Token values copied onto every Page/Dock scope, including portaled Dock UI. */
export function useZoneThemeScopeStyle(): ZoneThemeStyle | undefined {
	return useContext(ZoneThemeScopeStyleContext);
}

export function ZoneThemeContent({
	children,
	hero,
	theme,
	stylesheet,
	onUseDefaultTheme,
	useDefaultThemeFailed,
	useDefaultThemePending,
}: {
	readonly children: ReactNode;
	readonly hero: { readonly id: string; readonly url: string } | null;
	readonly theme: ZoneThemeDocument;
	readonly stylesheet: {
		readonly revisionId: string;
		readonly sha256: string;
		readonly css: string;
	} | null;
	readonly onUseDefaultTheme: () => void;
	readonly useDefaultThemeFailed: boolean;
	readonly useDefaultThemePending: boolean;
}) {
	const { t } = useTranslation("zones");
	const themeStyle = zoneThemeStyle(theme);
	return (
		<ZoneThemeScopeStyleContext value={themeStyle}>
			<div
				className="min-w-0 flex-1 bg-[var(--rezics-zone-surface-tint)] text-foreground"
				data-zone-color-scheme={theme.colorScheme}
				data-zone-theme-content=""
				style={themeStyle}
			>
				{stylesheet ? (
					<>
						<style data-zone-theme-revision={stylesheet.revisionId}>{stylesheet.css}</style>
						<aside className="relative z-40 border-b bg-background px-4 py-2 text-foreground">
							<div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-3">
								<p className="text-muted-foreground text-xs">{t.theme.viewerDefaultScope}</p>
								<Button
									disabled={useDefaultThemePending}
									onClick={onUseDefaultTheme}
									size="sm"
									variant="outline"
								>
									{t.theme.viewerDefault}
								</Button>
								{useDefaultThemeFailed ? (
									<p className="text-destructive text-xs" role="alert">
										{t.theme.viewerDefaultFailed}
									</p>
								) : null}
							</div>
						</aside>
					</>
				) : null}
				{hero ? (
					<div aria-hidden className="max-h-80 min-h-32 overflow-hidden" data-zone-part="hero">
						<img alt="" className="h-full max-h-80 min-h-32 w-full object-cover" src={hero.url} />
					</div>
				) : null}
				{children}
			</div>
		</ZoneThemeScopeStyleContext>
	);
}
