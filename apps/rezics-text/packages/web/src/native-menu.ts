import { listen } from "@tauri-apps/api/event";
import { Menu, Submenu } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
	isRezicsTextApplicationCommand,
	type RezicsTextApplicationCommand,
	type RezicsTextNativeMenuHost,
} from "@rezics/text-app";

function isMacPlatform(): boolean {
	return /Mac|iPhone|iPad/u.test(navigator.platform);
}

function commandItem(
	id: RezicsTextApplicationCommand,
	text: string,
	onCommand: (command: RezicsTextApplicationCommand) => void,
	accelerator?: string,
) {
	return {
		id,
		text,
		accelerator,
		action: () => onCommand(id),
	};
}

async function attachLocalizedWindowMenu(
	messages: Parameters<RezicsTextNativeMenuHost["install"]>[0]["messages"],
	onCommand: (command: RezicsTextApplicationCommand) => void,
): Promise<void> {
	const mac = isMacPlatform();
	const window = getCurrentWindow();
	const fileMenu = await Submenu.new({
		text: messages.menus.file,
		items: [
			commandItem("new-document", messages.actions.newDocument, onCommand, "CmdOrCtrl+N"),
			commandItem("new-folder", messages.menus.newFolder, onCommand),
			commandItem("open", messages.menus.open, onCommand, "CmdOrCtrl+O"),
			{ item: "Separator" },
			commandItem("save", messages.actions.save, onCommand, "CmdOrCtrl+S"),
			commandItem("save-as", messages.menus.saveAs, onCommand, "CmdOrCtrl+Shift+S"),
			{ item: "Separator" },
			commandItem("close", messages.actions.closeDocument, onCommand, "CmdOrCtrl+W"),
			commandItem("close-all", messages.menus.closeAll, onCommand),
			{ item: "Separator" },
			commandItem("preferences", messages.menus.preferences, onCommand, "CmdOrCtrl+,"),
			...(mac
				? []
				: [{ item: "Separator" as const }, { item: "Quit" as const, text: messages.menus.quit }]),
		],
	});
	const editMenu = await Submenu.new({
		text: messages.menus.edit,
		items: [
			{ item: "Undo", text: messages.menus.undo },
			{ item: "Redo", text: messages.menus.redo },
			{ item: "Separator" },
			{ item: "Cut", text: messages.menus.cut },
			{ item: "Copy", text: messages.menus.copy },
			{ item: "Paste", text: messages.menus.paste },
			{ item: "SelectAll", text: messages.menus.selectAll },
		],
	});
	const viewMenu = await Submenu.new({
		text: messages.menus.view,
		items: [
			commandItem("toggle-sidebar", messages.menus.toggleSidebar, onCommand, "CmdOrCtrl+B"),
			{ item: "Separator" },
			commandItem("source", messages.labels.sourceMode, onCommand),
			commandItem("preview", messages.labels.livePreviewMode, onCommand),
			{ item: "Separator" },
			{ item: "Minimize", text: messages.menus.minimize },
			{ item: "Maximize", text: messages.menus.maximize },
			{ item: "Fullscreen", text: messages.menus.fullscreen },
		],
	});
	const helpMenu = await Submenu.new({
		text: messages.menus.help,
		items: [commandItem("about", messages.menus.about, onCommand)],
	});
	const items = mac
		? [
				await Submenu.new({
					text: messages.productName,
					items: [
						commandItem("about", messages.menus.about, onCommand),
						{ item: "Separator" },
						{ item: "Hide" },
						{ item: "HideOthers" },
						{ item: "ShowAll" },
						{ item: "Separator" },
						{ item: "Quit", text: messages.menus.quit },
					],
				}),
				fileMenu,
				editMenu,
				viewMenu,
				helpMenu,
			]
		: [fileMenu, editMenu, viewMenu, helpMenu];
	const menu = await Menu.new({ items });
	if (mac) {
		await menu.setAsAppMenu();
		await helpMenu.setAsHelpMenuForNSApp();
		return;
	}
	await menu.setAsWindowMenu(window);
}

export const tauriNativeMenuHost: RezicsTextNativeMenuHost = {
	install: async ({ messages, onCommand }) => {
		try {
			await attachLocalizedWindowMenu(messages, onCommand);
		} catch {
			// The Rust host already attached a native window menu before the WebView loaded.
		}
		const unlisten = await listen<string>("rezics-text-menu", (event) => {
			if (isRezicsTextApplicationCommand(event.payload)) onCommand(event.payload);
		});
		return unlisten;
	},
};
