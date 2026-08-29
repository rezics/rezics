import type { Block } from "@rezics/block";
import { cn } from "@rezics/ui";
import type { ReactNode } from "react";

type UnitListBlock = Extract<Block, { readonly _type: "unit-list" }>;

function blockAppearance(block: Block): string | undefined {
	return block._type === "unit-ref" || block._type === "menu" ? block.appearance : undefined;
}

function blockLayout(block: Block): string | undefined {
	return block._type === "unit-list" || block._type === "group" ? block.layout : undefined;
}

function unitListItemSize(block: UnitListBlock): "sm" | "md" | "lg" {
	return block.presentation?.itemSize ?? "md";
}

/**
 * Stable styling-contract boundary shared by every Zone and Dock renderer.
 * Descendant DOM and utility classes remain private implementation details.
 */
export function BlockContractRoot({
	block,
	children,
	className,
}: {
	readonly block: Block;
	readonly children: ReactNode;
	readonly className?: string;
}) {
	const internalClassName = cn("min-w-0", className);
	const rootClassName = block.classNames?.length
		? `${internalClassName} ${block.classNames.join(" ")}`
		: internalClassName;
	return (
		<div
			className={rootClassName}
			data-appearance={blockAppearance(block)}
			data-block-type={block._type}
			data-item-size={block._type === "unit-list" ? unitListItemSize(block) : undefined}
			data-layout={blockLayout(block)}
		>
			{children}
		</div>
	);
}
