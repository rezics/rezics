import XIcon from "lucide-react/dist/esm/icons/x.mjs";
import type { ReactElement } from "react";
import type { MarkdownOpenDocument } from "../domain/workspace-state";
import type { MarkdownEditorMessages } from "../i18n/messages";
import { TooltipButton } from "./tooltip-button";

export function DocumentTabBar({
	messages,
	documents,
	activeId,
	onActivate,
	onClose,
}: {
	readonly messages: MarkdownEditorMessages;
	readonly documents: readonly MarkdownOpenDocument[];
	readonly activeId: string;
	readonly onActivate: (id: string) => void;
	readonly onClose: (id: string) => void;
}): ReactElement {
	return (
		<header
			aria-label={messages.labels.documentTabs}
			className="flex h-8 shrink-0 items-stretch border-border border-b bg-muted/55"
		>
			<div className="flex min-w-0 flex-1 overflow-x-auto">
				{documents.map((document) => {
					const selected = document.id === activeId;
					return (
						<div
							key={document.id}
							className={
								selected
									? "group flex max-w-56 min-w-32 shrink-0 items-center gap-1 border-border border-e bg-background px-2"
									: "group flex max-w-56 min-w-32 shrink-0 items-center gap-1 border-border border-e bg-transparent px-2 hover:bg-accent/60"
							}
						>
							<button
								type="button"
								aria-current={selected ? "page" : undefined}
								className={
									selected
										? "min-w-0 flex-1 truncate text-start text-[13px] text-foreground"
										: "min-w-0 flex-1 truncate text-start text-[13px] text-muted-foreground"
								}
								onClick={() => onActivate(document.id)}
							>
								{document.dirty ? `• ${document.file.name}` : document.file.name}
							</button>
							<TooltipButton
								className={
									document.dirty
										? "opacity-100"
										: "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
								}
								label={messages.actions.closeDocument}
								onClick={() => onClose(document.id)}
								size="icon-xs"
								variant="ghost"
							>
								<XIcon />
							</TooltipButton>
						</div>
					);
				})}
			</div>
		</header>
	);
}
