declare module "*.md" {
	import type { MDXProps } from "mdx/types";
	import type { ComponentType } from "react";
	const MarkdownComponent: ComponentType<MDXProps>;
	export default MarkdownComponent;
}

declare module "*.md?raw" {
	const content: string;
	export default content;
}

declare module "*.mdx" {
	import type { MDXProps } from "mdx/types";
	import type { ComponentType } from "react";
	const MDXComponent: ComponentType<MDXProps>;
	export default MDXComponent;
}

declare module "*.css";
