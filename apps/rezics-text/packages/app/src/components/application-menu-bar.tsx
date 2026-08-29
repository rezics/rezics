import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@rezics/ui/ui/menu";
import type { ReactElement, ReactNode } from "react";
import type { RezicsTextApplicationCommand } from "../domain/application-menu";
import {
	applicationCommandShortcutLabel,
	platformUsesCommandModifier,
} from "../domain/application-shortcuts";
import type { RezicsTextMessages } from "../i18n/messages";

export function ApplicationMenuBar({
	messages,
	onCommand,
}: {
	readonly messages: RezicsTextMessages;
	readonly onCommand: (command: RezicsTextApplicationCommand) => void;
}): ReactElement {
	const commandModifier = platformUsesCommandModifier(
		typeof navigator === "undefined" ? undefined : navigator.platform,
	);
	const shortcut = (command: RezicsTextApplicationCommand): string | undefined =>
		applicationCommandShortcutLabel(command, commandModifier);
	return (
		<nav
			aria-label={messages.labels.menuBar}
			className="flex h-7 shrink-0 items-center gap-0.5 border-border border-b bg-muted/70 px-1"
			role="menubar"
		>
			<MenuGroup label={messages.menus.file}>
				<CommandItem
					accelerator={shortcut("new-document")}
					label={messages.actions.newDocument}
					onSelect={() => onCommand("new-document")}
				/>
				<CommandItem label={messages.menus.newFolder} onSelect={() => onCommand("new-folder")} />
				<CommandItem
					accelerator={shortcut("open")}
					label={messages.menus.open}
					onSelect={() => onCommand("open")}
				/>
				<MenuSeparator />
				<CommandItem
					accelerator={shortcut("save")}
					label={messages.actions.save}
					onSelect={() => onCommand("save")}
				/>
				<CommandItem
					accelerator={shortcut("save-as")}
					label={messages.menus.saveAs}
					onSelect={() => onCommand("save-as")}
				/>
				<MenuSeparator />
				<CommandItem
					accelerator={shortcut("close")}
					label={messages.actions.closeDocument}
					onSelect={() => onCommand("close")}
				/>
				<CommandItem label={messages.menus.closeAll} onSelect={() => onCommand("close-all")} />
				<MenuSeparator />
				<CommandItem
					accelerator={shortcut("preferences")}
					label={messages.menus.preferences}
					onSelect={() => onCommand("preferences")}
				/>
			</MenuGroup>
			<MenuGroup label={messages.menus.edit}>
				<CommandItem
					accelerator={commandModifier ? "⌘Z" : "Ctrl+Z"}
					label={messages.menus.undo}
					onSelect={() => runBrowserEdit("undo")}
				/>
				<CommandItem
					accelerator={commandModifier ? "⇧⌘Z" : "Ctrl+Y"}
					label={messages.menus.redo}
					onSelect={() => runBrowserEdit("redo")}
				/>
				<MenuSeparator />
				<CommandItem
					accelerator={commandModifier ? "⌘X" : "Ctrl+X"}
					label={messages.menus.cut}
					onSelect={() => runBrowserEdit("cut")}
				/>
				<CommandItem
					accelerator={commandModifier ? "⌘C" : "Ctrl+C"}
					label={messages.menus.copy}
					onSelect={() => runBrowserEdit("copy")}
				/>
				<CommandItem
					accelerator={commandModifier ? "⌘V" : "Ctrl+V"}
					label={messages.menus.paste}
					onSelect={() => runBrowserEdit("paste")}
				/>
				<CommandItem
					accelerator={commandModifier ? "⌘A" : "Ctrl+A"}
					label={messages.menus.selectAll}
					onSelect={() => runBrowserEdit("selectAll")}
				/>
			</MenuGroup>
			<MenuGroup label={messages.menus.view}>
				<CommandItem
					accelerator={shortcut("toggle-sidebar")}
					label={messages.menus.toggleSidebar}
					onSelect={() => onCommand("toggle-sidebar")}
				/>
				<MenuSeparator />
				<CommandItem label={messages.labels.sourceMode} onSelect={() => onCommand("source")} />
				<CommandItem
					label={messages.labels.livePreviewMode}
					onSelect={() => onCommand("preview")}
				/>
				<MenuSeparator />
				<CommandItem
					label={messages.menus.fullscreen}
					onSelect={() => {
						if (document.fullscreenElement) void document.exitFullscreen();
						else void document.documentElement.requestFullscreen();
					}}
				/>
			</MenuGroup>
			<MenuGroup label={messages.menus.help}>
				<CommandItem label={messages.menus.about} onSelect={() => onCommand("about")} />
			</MenuGroup>
		</nav>
	);
}

function MenuGroup({
	label,
	children,
}: {
	readonly label: string;
	readonly children: ReactNode;
}): ReactElement {
	return (
		<Menu positioning={{ placement: "bottom-start" }}>
			<MenuTrigger className="h-6 rounded-sm px-2 text-[12px] text-foreground hover:bg-accent">
				{label}
			</MenuTrigger>
			<MenuContent className="min-w-52">{children}</MenuContent>
		</Menu>
	);
}

function CommandItem({
	label,
	accelerator,
	onSelect,
}: {
	readonly label: string;
	readonly accelerator?: string;
	readonly onSelect: () => void;
}): ReactElement {
	return (
		<MenuItem className="justify-between gap-6" onSelect={onSelect} value={label}>
			<span>{label}</span>
			{accelerator ? (
				<span className="text-[11px] text-muted-foreground">{accelerator}</span>
			) : null}
		</MenuItem>
	);
}

function runBrowserEdit(command: "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll"): void {
	const mapped = command === "selectAll" ? "selectAll" : command === "redo" ? "redo" : command;
	document.execCommand(mapped);
}
