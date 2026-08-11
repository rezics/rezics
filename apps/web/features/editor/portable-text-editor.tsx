"use client";

import type { PortableTextEditor as PortableTextEditorComponent } from "@rezics/ui/custom/portable-text-editor";
import { Button, Spinner } from "@rezics/ui";
import dynamic, { type DynamicOptionsLoadingProps } from "next/dynamic";
import type { ComponentProps } from "react";

import { useTranslation } from "@/i18n/client";

type PortableTextEditorProps = ComponentProps<typeof PortableTextEditorComponent>;
type PortableTextEditorModule = typeof import("@rezics/ui/custom/portable-text-editor");

export const spoilerPortableTextEditorCapabilities = {
	spoilers: true,
} satisfies NonNullable<PortableTextEditorProps["capabilities"]>;

let portableTextEditorModulePromise: Promise<PortableTextEditorModule> | undefined;

function loadPortableTextEditorModule(): Promise<PortableTextEditorModule> {
	if (portableTextEditorModulePromise) return portableTextEditorModulePromise;

	const promise = import("@rezics/ui/custom/portable-text-editor");
	portableTextEditorModulePromise = promise;
	void promise.catch((error: unknown) => {
		if (portableTextEditorModulePromise === promise) portableTextEditorModulePromise = undefined;
		console.error("Portable text editor loading failed.", error);
	});
	return promise;
}

export function preloadPortableTextEditor(): void {
	if (typeof window === "undefined") return;
	void loadPortableTextEditorModule().catch(() => undefined);
}

function PortableTextEditorLoading({ error, retry }: DynamicOptionsLoadingProps) {
	const { t } = useTranslation(["actions", "editor"]);

	if (error) {
		return (
			<div
				className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-input bg-muted/20 p-6 text-center"
				role="alert"
			>
				<p className="text-destructive text-sm">{t.editor.loadFailed}</p>
				{typeof retry === "function" ? (
					<Button onClick={retry} size="sm" type="button" variant="outline">
						{t.actions.retry}
					</Button>
				) : null}
			</div>
		);
	}

	return (
		<div
			aria-busy
			aria-live="polite"
			className="flex min-h-48 items-center justify-center gap-2 rounded-xl border border-input bg-muted/20 p-6 text-muted-foreground"
			role="status"
		>
			<Spinner aria-hidden className="size-5" />
			<span className="text-sm">{t.editor.loading}</span>
		</div>
	);
}

export const PortableTextEditor = dynamic<PortableTextEditorProps>(
	() => loadPortableTextEditorModule().then(({ PortableTextEditor: Editor }) => Editor),
	{
		ssr: false,
		loading: PortableTextEditorLoading,
	},
);
