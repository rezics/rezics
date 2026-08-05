"use client";

import {
	PortableText,
	type PortableTextComponents,
	type PortableTextTypeComponent,
} from "@portabletext/react";
import {
	normalizePortableText,
	normalizePortableTextUrl,
	type PortableTextImageBlock,
	type PortableTextSpoilerDefinition,
	type PortableTextValueUnitMention,
	type PortableTextValueBlock,
} from "@rezics/portable-text";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";

import { cn } from "../utils";
import { UnitMentionBadge, useUnitMentionPresentations } from "./unit-mention";
import { type UnitMentionPresentation, useUiMessages } from "./ui-provider";

export type PortableTextContentVariant = "compact" | "article" | "preview";

const SpoilerPresentationsContext = createContext<ReadonlyMap<string, UnitMentionPresentation>>(
	new Map(),
);

function SpoilerMark({
	children,
	value,
}: {
	children: ReactNode;
	value?: PortableTextSpoilerDefinition;
}) {
	const { editor: labels } = useUiMessages();
	const presentations = useContext(SpoilerPresentationsContext);
	const [revealed, setRevealed] = useState(false);
	const contentId = useId();
	const contentRef = useRef<HTMLSpanElement>(null);
	const scopedTitle = value?.scopeUnitId
		? presentations.get(value.scopeUnitId)?.label
		: undefined;
	const revealLabel = scopedTitle
		? labels.showScopedSpoiler({ title: scopedTitle })
		: labels.showSpoiler;

	useEffect(() => {
		if (revealed) contentRef.current?.focus();
	}, [revealed]);

	return (
		<span
			className="inline"
			data-spoiler-scope-unit-id={value?.scopeUnitId}
			data-spoiler-state={revealed ? "revealed" : "concealed"}
		>
			{revealed ? null : (
				<button
					aria-controls={contentId}
					aria-label={revealLabel}
					className="mx-0.5 inline-flex min-h-6 max-w-full cursor-pointer select-none items-center rounded-md bg-foreground px-2 py-0.5 align-baseline font-medium text-background text-xs leading-5 shadow-xs outline-none transition-colors hover:bg-foreground/88 focus-visible:ring-[3px] focus-visible:ring-ring/40 motion-reduce:transition-none"
					onClick={() => setRevealed(true)}
					type="button"
				>
					{revealLabel}
				</button>
			)}
			<span
				className="outline-none focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/40"
				hidden={!revealed}
				id={contentId}
				ref={contentRef}
				tabIndex={-1}
			>
				{children}
			</span>
		</span>
	);
}

function PreviewSpoilerMark() {
	const { editor: labels } = useUiMessages();
	return (
		<span
			aria-label={labels.spoilerPreview}
			className="mx-0.5 inline-flex min-h-5 min-w-20 select-none items-center rounded bg-foreground px-2 align-baseline text-background text-xs"
			data-spoiler-state="preview"
			role="img"
		>
			{labels.spoilerPreview}
		</span>
	);
}

const components = {
	block: {
		normal: ({ children }) => <p>{children}</p>,
		h2: ({ children }) => <h2>{children}</h2>,
		h3: ({ children }) => <h3>{children}</h3>,
		blockquote: ({ children }) => <blockquote>{children}</blockquote>,
	},
	list: {
		bullet: ({ children }) => <ul>{children}</ul>,
		number: ({ children }) => <ol>{children}</ol>,
	},
	listItem: {
		bullet: ({ children }) => <li>{children}</li>,
		number: ({ children }) => <li>{children}</li>,
	},
	marks: {
		link: ({ children, value }) => {
			const href = normalizePortableTextUrl(value?.href);
			if (!href) return <>{children}</>;
			const openInNewTab = value?.openInNewTab === true;
			return (
				<a
					href={href}
					rel={openInNewTab ? "noopener noreferrer" : undefined}
					target={openInNewTab ? "_blank" : undefined}
				>
					{children}
				</a>
			);
		},
		spoiler: SpoilerMark,
	},
	types: {
		image: ({ value }) => (
			<figure>
				<img alt={value.alt ?? ""} src={`/image-assets/${value.assetId}/content`} />
				{value.caption && <figcaption>{value.caption}</figcaption>}
			</figure>
		),
	},
} satisfies PortableTextComponents<
	PortableTextValueBlock | PortableTextImageBlock | PortableTextValueUnitMention
>;

const previewComponents = {
	...components,
	marks: {
		...components.marks,
		link: ({ children }) => <>{children}</>,
		spoiler: PreviewSpoilerMark,
	},
} satisfies PortableTextComponents<
	PortableTextValueBlock | PortableTextImageBlock | PortableTextValueUnitMention
>;

const variantClasses: Record<PortableTextContentVariant, string> = {
	compact:
		"grid gap-2 text-sm leading-6 text-foreground/88 [&_blockquote]:border-s-2 [&_blockquote]:border-brand/45 [&_blockquote]:ps-3 [&_blockquote]:italic [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5",
	preview:
		"line-clamp-3 text-sm leading-6 text-muted-foreground [&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5",
	article:
		"prose max-w-none text-foreground prose-headings:font-serif prose-headings:text-foreground prose-p:leading-8 prose-a:text-link prose-a:decoration-link/35 prose-a:underline-offset-4 hover:prose-a:decoration-link prose-blockquote:border-brand/45 prose-blockquote:text-muted-foreground prose-li:my-1",
};

export function PortableTextContent({
	value,
	variant = "compact",
	className,
	types,
	unitMentionPresentations,
}: {
	value: unknown;
	variant?: PortableTextContentVariant;
	className?: string;
	/** Custom Portable Text block-object renderers keyed by `_type`. */
	types?: Readonly<Record<string, PortableTextTypeComponent | undefined>>;
	unitMentionPresentations?: ReadonlyMap<string, UnitMentionPresentation>;
}) {
	const normalized = normalizePortableText(value);
	const resolvedUnitMentions = useUnitMentionPresentations(
		unitMentionPresentations ? [] : normalized,
	);
	const mentions = unitMentionPresentations ?? resolvedUnitMentions;
	if (normalized.length === 0) return null;
	const baseComponents = variant === "preview" ? previewComponents : components;
	const resolvedComponents = {
		...baseComponents,
		types: {
			...baseComponents.types,
			"unit-mention": ({ value }: { value: PortableTextValueUnitMention }) => (
				<UnitMentionBadge presentation={mentions.get(value.unitId)} value={value} />
			),
			...types,
		},
	};

	return (
		<SpoilerPresentationsContext.Provider value={mentions}>
			<div className={cn(variantClasses[variant], className)} data-portable-text={variant}>
				<PortableText
					components={resolvedComponents}
					onMissingComponent={false}
					value={normalized}
				/>
			</div>
		</SpoilerPresentationsContext.Provider>
	);
}
