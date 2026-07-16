import type { ComponentType, ReactNode } from "react";

export const mdxComponents = {
	a: ({ href, children, ...props }: { href?: string; children?: ReactNode }) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
	h1: ({ children }: { children?: ReactNode }) => <h1 className="section-title">{children}</h1>,
	p: ({ children }: { children?: ReactNode }) => <p className="section-lead">{children}</p>,
} satisfies Record<string, ComponentType<any>>;
