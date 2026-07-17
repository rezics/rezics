import { PortableText, type PortableTextComponents } from "@portabletext/react";
import {
	normalizePortableText,
	normalizePortableTextUrl,
	type PortableTextValueBlock,
} from "@rezics/portable-text";

import { cn } from "../utils";

export type PortableTextContentVariant = "compact" | "article" | "preview";

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
	},
} satisfies PortableTextComponents<PortableTextValueBlock>;

const previewComponents = {
	...components,
	marks: {
		...components.marks,
		link: ({ children }) => <>{children}</>,
	},
} satisfies PortableTextComponents<PortableTextValueBlock>;

const variantClasses: Record<PortableTextContentVariant, string> = {
	compact:
		"grid gap-2 text-sm leading-6 text-foreground/88 [&_blockquote]:border-s-2 [&_blockquote]:border-primary/45 [&_blockquote]:ps-3 [&_blockquote]:italic [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5",
	preview:
		"line-clamp-3 text-sm leading-6 text-muted-foreground [&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5",
	article:
		"prose max-w-none text-foreground prose-headings:font-serif prose-headings:text-foreground prose-p:leading-8 prose-a:text-link prose-a:decoration-link/35 prose-a:underline-offset-4 hover:prose-a:decoration-link prose-blockquote:border-primary/45 prose-blockquote:text-muted-foreground prose-li:my-1",
};

export function PortableTextContent({
	value,
	variant = "compact",
	className,
}: {
	value: unknown;
	variant?: PortableTextContentVariant;
	className?: string;
}) {
	const normalized = normalizePortableText(value);
	if (normalized.length === 0) return null;

	return (
		<div className={cn(variantClasses[variant], className)} data-portable-text={variant}>
			<PortableText
				components={variant === "preview" ? previewComponents : components}
				onMissingComponent={false}
				value={normalized}
			/>
		</div>
	);
}
