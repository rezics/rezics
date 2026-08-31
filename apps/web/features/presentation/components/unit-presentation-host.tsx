"use client";

import type { UnitReferencedBlockDocument } from "@rezics/block";
import { Button } from "@rezics/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { activateHostFullTrustCustomTheme } from "../model/host-full-trust-runtime";
import {
	activePresentationPolicyNavigation,
	startActivePresentationPolicyMonitor,
} from "../model/active-policy-monitor";
import type { ResolvedUnitPresentation } from "../model/resolved-presentation";
import { safeThemeHref } from "../model/safe-mode";

type PresentationRegion = "header" | "footer";
const PresentationPolicyReloadKey = "rezics:presentation-policy-reload";

export interface UnitPresentationHostCopy {
	readonly defaultThemeAction: string;
	readonly defaultThemeFailed: string;
	readonly defaultThemeScope: string;
	readonly runtimeFailed: string;
}

export function UnitPresentationHost({
	children,
	copy,
	headerLabel,
	hostUnit,
	onUseDefaultTheme,
	platformHeader,
	presentation,
	renderRegion,
	useDefaultThemeFailed,
	useDefaultThemePending,
}: {
	readonly children: ReactNode;
	readonly copy: UnitPresentationHostCopy;
	readonly headerLabel: string;
	readonly hostUnit: { readonly id: string; readonly kind: "zone" };
	readonly onUseDefaultTheme: () => void;
	readonly platformHeader: ReactNode;
	readonly presentation: ResolvedUnitPresentation;
	readonly renderRegion: (
		document: UnitReferencedBlockDocument,
		region: PresentationRegion,
	) => ReactNode;
	readonly useDefaultThemeFailed: boolean;
	readonly useDefaultThemePending: boolean;
}) {
	const [runtimeState, setRuntimeState] = useState<"fallback" | "loading" | "active" | "failed">(
		presentation.customTheme ? "loading" : "fallback",
	);
	const headerRoot = useRef<HTMLElement>(null);
	const headerFragment = useRef<HTMLDivElement>(null);
	const mainRoot = useRef<HTMLElement>(null);
	const footerRoot = useRef<HTMLElement>(null);
	const footerFragment = useRef<HTMLDivElement>(null);
	const customTheme = presentation.customTheme;

	useEffect(() => {
		if (!customTheme) {
			setRuntimeState("fallback");
			return;
		}
		const documentRevision = document.documentElement.dataset.rezicsPresentationRevision ?? "";
		if (documentRevision !== customTheme.revisionId) {
			const reloadAttempt = `${window.location.href}\n${customTheme.revisionId}`;
			if (sessionStorage.getItem(PresentationPolicyReloadKey) === reloadAttempt) {
				sessionStorage.removeItem(PresentationPolicyReloadKey);
				window.location.assign(safeThemeHref(window.location.href));
			} else {
				sessionStorage.setItem(PresentationPolicyReloadKey, reloadAttempt);
				window.location.reload();
			}
			return;
		}
		sessionStorage.removeItem(PresentationPolicyReloadKey);
		const roots = {
			header: headerRoot.current,
			headerFragment: headerFragment.current,
			main: mainRoot.current,
			footer: footerRoot.current,
			footerFragment: footerFragment.current,
		};
		if (
			!roots.header ||
			!roots.headerFragment ||
			!roots.main ||
			!roots.footer ||
			!roots.footerFragment
		)
			return;
		setRuntimeState("loading");
		const runtime = activateHostFullTrustCustomTheme({
			hostUnit,
			roots: {
				header: roots.header,
				headerFragment: roots.headerFragment,
				main: roots.main,
				footer: roots.footer,
				footerFragment: roots.footerFragment,
			},
			theme: customTheme,
			onActive: () => setRuntimeState("active"),
			onPreExecutionFailure: () => setRuntimeState("failed"),
			onPostExecutionFailure: () => {
				setRuntimeState("failed");
				window.location.assign(safeThemeHref(window.location.href));
			},
		});
		const policyMonitor = startActivePresentationPolicyMonitor({
			hostUnitId: hostUnit.id,
			revisionId: customTheme.revisionId,
			onInvalidated: (nextRevisionId) => {
				const navigation = activePresentationPolicyNavigation(
					customTheme.revisionId,
					nextRevisionId,
				);
				if (navigation === "continue") return;
				runtime.dispose();
				setRuntimeState("failed");
				if (navigation === "reload") window.location.reload();
				else window.location.assign(safeThemeHref(window.location.href));
			},
		});
		void policyMonitor.check();
		return () => {
			policyMonitor.dispose();
			runtime.dispose();
		};
	}, [customTheme, hostUnit.id, hostUnit.kind]);

	const headerDocument = presentation.document.header;
	const footerDocument = presentation.document.footer;
	return (
		<div
			data-custom-theme-revision={customTheme?.revisionId}
			data-custom-theme-runtime={runtimeState}
			data-unit-presentation-contract={presentation.targetContract}
		>
			{customTheme ? (
				<aside className="relative z-40 border-b bg-background px-4 py-2 text-foreground">
					<div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-3">
						<p className="text-muted-foreground text-xs">{copy.defaultThemeScope}</p>
						<Button
							disabled={useDefaultThemePending}
							onClick={onUseDefaultTheme}
							size="sm"
							variant="outline"
						>
							{copy.defaultThemeAction}
						</Button>
						{useDefaultThemeFailed ? (
							<p className="text-destructive text-xs" role="alert">
								{copy.defaultThemeFailed}
							</p>
						) : null}
						{runtimeState === "failed" ? (
							<p className="text-destructive text-xs" role="alert">
								{copy.runtimeFailed}
							</p>
						) : null}
					</div>
				</aside>
			) : null}
			{platformHeader}
			<header aria-label={headerLabel} data-unit-presentation-region="header" ref={headerRoot}>
				{headerDocument.blocks.length > 0 ? renderRegion(headerDocument, "header") : null}
				<div data-unit-presentation-fragment="header.append" ref={headerFragment} />
			</header>
			<main data-unit-presentation-region="main" ref={mainRoot}>
				{children}
			</main>
			<footer data-unit-presentation-region="footer" ref={footerRoot}>
				{footerDocument.blocks.length > 0 ? renderRegion(footerDocument, "footer") : null}
				<div data-unit-presentation-fragment="footer.append" ref={footerFragment} />
			</footer>
		</div>
	);
}
