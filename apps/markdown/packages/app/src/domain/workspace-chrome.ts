import type { MarkdownEditingMode } from "./workspace-state";

export const markdownSidebarTabs = ["files", "outline"] as const;
export type MarkdownSidebarTab = (typeof markdownSidebarTabs)[number];

export function isMarkdownSidebarTab(value: unknown): value is MarkdownSidebarTab {
	return value === "files" || value === "outline";
}

export function toggleMarkdownEditingMode(current: MarkdownEditingMode): MarkdownEditingMode {
	return current === "source" ? "preview" : "source";
}
