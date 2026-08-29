import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import type { RezicsTextThemePreference } from "../domain/appearance";
import type { MarkdownStorageErrorCode } from "../storage";

export const rezicsTextLocales = ["en", "zh-Hans", "zh-Hant"] as const;
export type RezicsTextLocale = (typeof rezicsTextLocales)[number];

export function isRezicsTextLocale(value: unknown): value is RezicsTextLocale {
	return typeof value === "string" && rezicsTextLocales.some((locale) => locale === value);
}

export interface RezicsTextMessages {
	readonly locale: RezicsTextLocale;
	readonly productName: string;
	readonly documentTitle: (name: string, dirty: boolean) => string;
	readonly untitledName: string;
	readonly newFolderName: string;
	readonly labels: {
		readonly application: string;
		readonly menuBar: string;
		readonly sidebar: string;
		readonly files: string;
		readonly outline: string;
		readonly noOutline: string;
		readonly emptyFolder: string;
		readonly editorPlaceholder: string;
		readonly resizeSidebar: string;
		readonly documentStatistics: string;
		readonly statusBar: string;
		readonly documentTabs: string;
		readonly sourceEditor: string;
		readonly livePreviewEditor: string;
		readonly language: string;
		readonly sourceMode: string;
		readonly livePreviewMode: string;
		readonly aboutSummary: string;
		readonly version: (version: string) => string;
	};
	readonly menus: {
		readonly file: string;
		readonly edit: string;
		readonly view: string;
		readonly help: string;
		readonly about: string;
		readonly preferences: string;
		readonly newFolder: string;
		readonly open: string;
		readonly saveAs: string;
		readonly closeAll: string;
		readonly toggleSidebar: string;
		readonly undo: string;
		readonly redo: string;
		readonly cut: string;
		readonly copy: string;
		readonly paste: string;
		readonly selectAll: string;
		readonly minimize: string;
		readonly maximize: string;
		readonly fullscreen: string;
		readonly quit: string;
	};
	readonly actions: {
		readonly newDocument: string;
		readonly newFolder: string;
		readonly open: string;
		readonly save: string;
		readonly saveAs: string;
		readonly closeDocument: string;
		readonly closeAll: string;
		readonly showSidebar: string;
		readonly hideSidebar: string;
		readonly enterSource: string;
		readonly enterLivePreview: string;
		readonly about: string;
		readonly close: string;
		readonly dismiss: string;
	};
	readonly preferences: {
		readonly title: string;
		readonly description: string;
		readonly backToEditor: string;
		readonly navigation: string;
		readonly general: string;
		readonly generalDescription: string;
		readonly files: string;
		readonly filesDescription: string;
		readonly filesPlaceholder: string;
		readonly theme: string;
		readonly themeDescription: string;
		readonly themes: Readonly<Record<RezicsTextThemePreference, string>>;
	};
	readonly status: {
		readonly saved: string;
		readonly unsaved: string;
		readonly opening: string;
		readonly saving: string;
		readonly editorLoading: string;
		readonly words: (count: number) => string;
		readonly characters: (count: number) => string;
		readonly lines: (count: number) => string;
		readonly headings: (count: number) => string;
		readonly cursor: (line: number, column: number) => string;
		readonly readingTime: (minutes: number) => string;
	};
	readonly prompts: {
		readonly discardChanges: string;
	};
	readonly notices: {
		readonly saved: string;
		readonly storageErrors: Readonly<Record<MarkdownStorageErrorCode, string>>;
	};
	readonly languages: Readonly<Record<RezicsTextLocale, string>>;
}

const markdown = verbatimTerms.markdown.value;
const mdFileExtension = verbatimTerms.mdFileExtension.value;
const markdownFileExtension = verbatimTerms.markdownFileExtension.value;
const mib = verbatimTerms.mib.value;
const utf8 = verbatimTerms.utf8.value;
const productName = verbatimTerms.rezicsText.value;

const en: RezicsTextMessages = {
	locale: "en",
	productName,
	documentTitle: (name, dirty) => `${dirty ? "• " : ""}${name} — ${productName}`,
	untitledName: `Untitled${mdFileExtension}`,
	newFolderName: "New Folder",
	labels: {
		application: `${productName} application`,
		menuBar: "Application menu",
		sidebar: "Sidebar",
		files: "Files",
		outline: "Outline",
		noOutline: "Add a heading to build the outline.",
		emptyFolder: "Empty folder",
		editorPlaceholder: "Start writing…",
		resizeSidebar: "Resize sidebar",
		documentStatistics: "Document statistics",
		statusBar: "Status",
		documentTabs: "Open documents",
		sourceEditor: `${markdown} source editor`,
		livePreviewEditor: `${markdown} live-preview editor`,
		language: "Language",
		sourceMode: "Source",
		livePreviewMode: "Live preview",
		aboutSummary: `A local ${markdown} editor.`,
		version: (version) => `Version ${version}`,
	},
	menus: {
		file: "File",
		edit: "Edit",
		view: "View",
		help: "Help",
		about: "About",
		preferences: "Preferences",
		newFolder: "New Folder",
		open: "Open…",
		saveAs: "Save As…",
		closeAll: "Close All",
		toggleSidebar: "Toggle Sidebar",
		undo: "Undo",
		redo: "Redo",
		cut: "Cut",
		copy: "Copy",
		paste: "Paste",
		selectAll: "Select All",
		minimize: "Minimize",
		maximize: "Maximize",
		fullscreen: "Full Screen",
		quit: "Quit",
	},
	actions: {
		newDocument: "New document",
		newFolder: "New folder",
		open: "Open",
		save: "Save",
		saveAs: "Save as",
		closeDocument: "Close document",
		closeAll: "Close all documents",
		showSidebar: "Show sidebar",
		hideSidebar: "Hide sidebar",
		enterSource: "Edit source",
		enterLivePreview: "Live preview",
		about: "About",
		close: "Close",
		dismiss: "Dismiss",
	},
	preferences: {
		title: "Preferences",
		description: "Choose how the editor looks and behaves on this device.",
		backToEditor: "Back to editor",
		navigation: "Preference sections",
		general: "General",
		generalDescription: "Language and appearance for this editor.",
		files: "Files",
		filesDescription: "How the editor works with local files.",
		filesPlaceholder: "File preferences will appear here.",
		theme: "Theme",
		themeDescription: "Use the system appearance or choose a fixed color scheme.",
		themes: { system: "System", light: "Light", dark: "Dark" },
	},
	status: {
		saved: "Saved",
		unsaved: "Unsaved changes",
		opening: "Opening…",
		saving: "Saving…",
		editorLoading: "Loading editor…",
		words: (count) => `${count} words`,
		characters: (count) => `${count} characters`,
		lines: (count) => `${count} lines`,
		headings: (count) => `${count} headings`,
		cursor: (line, column) => `Line ${line}, Column ${column}`,
		readingTime: (minutes) =>
			minutes === 0
				? "Less than a minute"
				: minutes === 1
					? "About 1 minute"
					: `About ${minutes} minutes`,
	},
	prompts: { discardChanges: "Discard unsaved changes?" },
	notices: {
		saved: "Document saved.",
		storageErrors: {
			conflict: "The file changed outside the editor. Save a copy or reopen it before overwriting.",
			"invalid-encoding": `The file is not valid ${utf8} ${markdown}.`,
			"invalid-response": "The desktop host returned an invalid response.",
			io: "The file operation failed.",
			"not-found": "The file is no longer available.",
			"too-large": `The document exceeds the 16 ${mib} local editing limit.`,
			unavailable: "This file operation is unavailable in the current environment.",
			"unsupported-extension": `Choose a ${mdFileExtension} or ${markdownFileExtension} file.`,
		},
	},
	languages: { en: "English", "zh-Hans": "简体中文", "zh-Hant": "繁體中文" },
};

const zhHans: RezicsTextMessages = {
	locale: "zh-Hans",
	productName,
	documentTitle: (name, dirty) => `${dirty ? "• " : ""}${name} — ${productName}`,
	untitledName: `未命名${mdFileExtension}`,
	newFolderName: "新建文件夹",
	labels: {
		application: `${productName} 应用`,
		menuBar: "应用菜单",
		sidebar: "侧边栏",
		files: "文件",
		outline: "大纲",
		noOutline: "添加标题后将在这里生成大纲。",
		emptyFolder: "空文件夹",
		editorPlaceholder: "开始写作……",
		resizeSidebar: "调整侧边栏宽度",
		documentStatistics: "文档统计",
		statusBar: "状态栏",
		documentTabs: "已打开的文档",
		sourceEditor: `${markdown} 源码编辑器`,
		livePreviewEditor: `${markdown} 实时预览编辑器`,
		language: "语言",
		sourceMode: "源码",
		livePreviewMode: "实时预览",
		aboutSummary: `一款本地 ${markdown} 编辑器。`,
		version: (version) => `版本 ${version}`,
	},
	menus: {
		file: "文件",
		edit: "编辑",
		view: "查看",
		help: "帮助",
		about: "关于",
		preferences: "偏好设置",
		newFolder: "新建文件夹",
		open: "打开…",
		saveAs: "另存为…",
		closeAll: "全部关闭",
		toggleSidebar: "显示或隐藏侧边栏",
		undo: "撤销",
		redo: "重做",
		cut: "剪切",
		copy: "复制",
		paste: "粘贴",
		selectAll: "全选",
		minimize: "最小化",
		maximize: "最大化",
		fullscreen: "全屏",
		quit: "退出",
	},
	actions: {
		newDocument: "新建文档",
		newFolder: "新建文件夹",
		open: "打开",
		save: "保存",
		saveAs: "另存为",
		closeDocument: "关闭文档",
		closeAll: "关闭全部文档",
		showSidebar: "显示侧边栏",
		hideSidebar: "隐藏侧边栏",
		enterSource: "编辑源码",
		enterLivePreview: "实时预览",
		about: "关于",
		close: "关闭",
		dismiss: "关闭",
	},
	preferences: {
		title: "偏好设置",
		description: "选择这台设备上编辑器的外观和行为。",
		backToEditor: "返回编辑器",
		navigation: "设置分类",
		general: "通用",
		generalDescription: "此编辑器的语言和外观。",
		files: "文件",
		filesDescription: "编辑器处理本地文件的方式。",
		filesPlaceholder: "文件相关设定将放在这里。",
		theme: "主题",
		themeDescription: "跟随系统外观，或选择固定配色。",
		themes: { system: "跟随系统", light: "浅色", dark: "深色" },
	},
	status: {
		saved: "已保存",
		unsaved: "有未保存的更改",
		opening: "正在打开…",
		saving: "正在保存…",
		editorLoading: "正在加载编辑器…",
		words: (count) => `${count} 字词`,
		characters: (count) => `${count} 字符`,
		lines: (count) => `${count} 行`,
		headings: (count) => `${count} 个标题`,
		cursor: (line, column) => `第 ${line} 行，第 ${column} 列`,
		readingTime: (minutes) =>
			minutes === 0 ? "不到 1 分钟" : minutes === 1 ? "约 1 分钟" : `约 ${minutes} 分钟`,
	},
	prompts: { discardChanges: "要放弃尚未保存的更改吗？" },
	notices: {
		saved: "文档已保存。",
		storageErrors: {
			conflict: "文件已被其他程序修改。请另存副本，或重新打开后再覆盖。",
			"invalid-encoding": `文件不是有效的 ${utf8} ${markdown} 文档。`,
			"invalid-response": "桌面宿主返回了无效响应。",
			io: "文件操作失败。",
			"not-found": "文件已不存在。",
			"too-large": `文档超过了 16 ${mib} 的本地编辑上限。`,
			unavailable: "当前环境不支持这项文件操作。",
			"unsupported-extension": `请选择 ${mdFileExtension} 或 ${markdownFileExtension} 文件。`,
		},
	},
	languages: { en: "English", "zh-Hans": "简体中文", "zh-Hant": "繁體中文" },
};

const zhHant: RezicsTextMessages = {
	locale: "zh-Hant",
	productName,
	documentTitle: (name, dirty) => `${dirty ? "• " : ""}${name} — ${productName}`,
	untitledName: `未命名${mdFileExtension}`,
	newFolderName: "新增資料夾",
	labels: {
		application: `${productName} 應用程式`,
		menuBar: "應用程式選單",
		sidebar: "側邊欄",
		files: "檔案",
		outline: "大綱",
		noOutline: "加入標題後，這裡會建立大綱。",
		emptyFolder: "空資料夾",
		editorPlaceholder: "開始寫作……",
		resizeSidebar: "調整側邊欄寬度",
		documentStatistics: "文件統計",
		statusBar: "狀態列",
		documentTabs: "已開啟的文件",
		sourceEditor: `${markdown} 原始碼編輯器`,
		livePreviewEditor: `${markdown} 即時預覽編輯器`,
		language: "語言",
		sourceMode: "原始碼",
		livePreviewMode: "即時預覽",
		aboutSummary: `一款本機 ${markdown} 編輯器。`,
		version: (version) => `版本 ${version}`,
	},
	menus: {
		file: "檔案",
		edit: "編輯",
		view: "顯示方式",
		help: "說明",
		about: "關於",
		preferences: "偏好設定",
		newFolder: "新增資料夾",
		open: "開啟…",
		saveAs: "另存新檔…",
		closeAll: "全部關閉",
		toggleSidebar: "顯示或隱藏側邊欄",
		undo: "復原",
		redo: "重做",
		cut: "剪下",
		copy: "複製",
		paste: "貼上",
		selectAll: "全選",
		minimize: "縮小",
		maximize: "放大",
		fullscreen: "全螢幕",
		quit: "結束",
	},
	actions: {
		newDocument: "新增文件",
		newFolder: "新增資料夾",
		open: "開啟",
		save: "儲存",
		saveAs: "另存新檔",
		closeDocument: "關閉文件",
		closeAll: "關閉全部文件",
		showSidebar: "顯示側邊欄",
		hideSidebar: "隱藏側邊欄",
		enterSource: "編輯原始碼",
		enterLivePreview: "即時預覽",
		about: "關於",
		close: "關閉",
		dismiss: "關閉",
	},
	preferences: {
		title: "偏好設定",
		description: "選擇這台裝置上編輯器的外觀與行為。",
		backToEditor: "返回編輯器",
		navigation: "設定分類",
		general: "一般",
		generalDescription: "此編輯器的語言與外觀。",
		files: "檔案",
		filesDescription: "編輯器處理本機檔案的方式。",
		filesPlaceholder: "檔案相關設定會放在這裡。",
		theme: "主題",
		themeDescription: "跟隨系統外觀，或選擇固定配色。",
		themes: { system: "跟隨系統", light: "淺色", dark: "深色" },
	},
	status: {
		saved: "已儲存",
		unsaved: "有未儲存的變更",
		opening: "正在開啟…",
		saving: "正在儲存…",
		editorLoading: "正在載入編輯器…",
		words: (count) => `${count} 個字詞`,
		characters: (count) => `${count} 個字元`,
		lines: (count) => `${count} 行`,
		headings: (count) => `${count} 個標題`,
		cursor: (line, column) => `第 ${line} 行，第 ${column} 列`,
		readingTime: (minutes) =>
			minutes === 0 ? "不到 1 分鐘" : minutes === 1 ? "約 1 分鐘" : `約 ${minutes} 分鐘`,
	},
	prompts: { discardChanges: "要捨棄尚未儲存的變更嗎？" },
	notices: {
		saved: "文件已儲存。",
		storageErrors: {
			conflict: "檔案已被其他程式修改。請另存副本，或重新開啟後再覆寫。",
			"invalid-encoding": `檔案不是有效的 ${utf8} ${markdown} 文件。`,
			"invalid-response": "桌面宿主傳回了無效回應。",
			io: "檔案操作失敗。",
			"not-found": "檔案已不存在。",
			"too-large": `文件超過 16 ${mib} 的本機編輯上限。`,
			unavailable: "目前環境不支援這項檔案操作。",
			"unsupported-extension": `請選擇 ${mdFileExtension} 或 ${markdownFileExtension} 檔案。`,
		},
	},
	languages: { en: "English", "zh-Hans": "简体中文", "zh-Hant": "繁體中文" },
};

export const rezicsTextMessages: Readonly<Record<RezicsTextLocale, RezicsTextMessages>> = {
	en,
	"zh-Hans": zhHans,
	"zh-Hant": zhHant,
};

export function resolveRezicsTextLocale(value: string | undefined): RezicsTextLocale {
	const normalized = value?.toLocaleLowerCase("en-US") ?? "";
	if (
		normalized.startsWith("zh-tw") ||
		normalized.startsWith("zh-hk") ||
		normalized.includes("hant")
	)
		return "zh-Hant";
	if (normalized.startsWith("zh")) return "zh-Hans";
	return "en";
}

export const rezicsTextLocaleStorageKey = "rezics-text-locale";

export function readStoredRezicsTextLocale(storage: Storage): RezicsTextLocale | undefined {
	try {
		const stored = storage.getItem(rezicsTextLocaleStorageKey);
		return isRezicsTextLocale(stored) ? stored : undefined;
	} catch {
		return undefined;
	}
}

export function writeStoredRezicsTextLocale(storage: Storage, locale: RezicsTextLocale): void {
	try {
		storage.setItem(rezicsTextLocaleStorageKey, locale);
	} catch {
		// Ignore quota or private-mode failures; the session locale still applies.
	}
}
