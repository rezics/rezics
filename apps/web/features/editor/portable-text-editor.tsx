"use client";

import type { PortableTextEditor as PortableTextEditorComponent } from "@rezics/ui/custom/portable-text-editor";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

type PortableTextEditorProps = ComponentProps<typeof PortableTextEditorComponent>;

export const PortableTextEditor = dynamic<PortableTextEditorProps>(
	() =>
		import("@rezics/ui/custom/portable-text-editor").then(
			({ PortableTextEditor: Editor }) => Editor,
		),
	{
		ssr: false,
		loading: () => (
			<div aria-busy className="min-h-48 animate-pulse rounded-lg border bg-muted/35" />
		),
	},
);
