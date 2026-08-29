import { Button } from "@rezics/ui/ui/button";
import XIcon from "lucide-react/dist/esm/icons/x.mjs";
import type { ReactElement } from "react";
import type { MarkdownOpenDocument } from "../domain/workspace-state";
import type { RezicsTextMessages } from "../i18n/messages";
import { TooltipButton } from "./tooltip-button";

export function DocumentTabBar({
	messages,
	documents,
	activeId,
	onActivate,
	onClose,
}: {
	readonly messages: RezicsTextMessages;
	readonly documents: readonly MarkdownOpenDocument[];
	readonly activeId: string | undefined;
	readonly onActivate: (id: string) => void;
	readonly onClose: (id: string) => void;
}): ReactElement {
	return (
		<header
			aria-label={messages.labels.documentTabs}
			className="flex h-10 shrink-0 items-stretch border-border-weak border-b bg-surface-container"
		>
			<div className="flex min-w-0 flex-1 overflow-x-auto">
				{documents.map((document) => {
					const selected = document.id === activeId;
					return (
						<div
							key={document.id}
							className={
								selected
									? "group flex max-w-56 min-w-32 shrink-0 items-center gap-0.5 border-border-weak border-e bg-background px-1"
									: "group flex max-w-56 min-w-32 shrink-0 items-center gap-0.5 border-border-weak border-e px-1 hover:bg-muted"
							}
						>
							<Button
								aria-current={selected ? "page" : undefined}
								className="h-full min-w-0 flex-1 justify-start overflow-hidden px-1.5 font-normal text-xs"
								onClick={() => onActivate(document.id)}
								size="sm"
								variant="ghost"
							>
								{document.dirty ? (
									<span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
								) : null}
								<span className="min-w-0 truncate">{document.file.name}</span>
							</Button>
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
