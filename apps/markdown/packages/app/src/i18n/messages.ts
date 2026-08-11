import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import type { MarkdownStorageErrorCode } from "../storage";

export const markdownEditorLocales = ["en", "zh-Hans", "zh-Hant"] as const;
export type MarkdownEditorLocale = (typeof markdownEditorLocales)[number];

export function isMarkdownEditorLocale(value: unknown): value is MarkdownEditorLocale {
	return typeof value === "string" && markdownEditorLocales.some((locale) => locale === value);
}

export interface MarkdownEditorMessages {
	readonly locale: MarkdownEditorLocale;
	readonly productName: string;
	readonly documentTitle: (name: string, dirty: boolean) => string;
	readonly untitledName: string;
	readonly welcomeDocument: string;
	readonly labels: {
		readonly application: string;
		readonly documents: string;
		readonly outline: string;
		readonly noOutline: string;
		readonly editorToolbar: string;
		readonly formattingToolbar: string;
		readonly sourceEditor: string;
		readonly livePreviewEditor: string;
		readonly language: string;
		readonly sourceMode: string;
		readonly livePreviewMode: string;
	};
	readonly actions: {
		readonly newDocument: string;
		readonly open: string;
		readonly save: string;
		readonly saveAs: string;
		readonly showDocuments: string;
		readonly showOutline: string;
		readonly source: string;
		readonly livePreview: string;
		readonly bold: string;
		readonly italic: string;
		readonly strikethrough: string;
		readonly inlineCode: string;
		readonly heading1: string;
		readonly heading2: string;
		readonly quote: string;
		readonly bulletList: string;
		readonly numberedList: string;
		readonly taskList: string;
		readonly link: string;
		readonly table: string;
		readonly codeBlock: string;
		readonly dismiss: string;
	};
	readonly status: {
		readonly saved: string;
		readonly unsaved: string;
		readonly opening: string;
		readonly saving: string;
		readonly editorLoading: string;
		readonly words: (count: number) => string;
		readonly characters: (count: number) => string;
	};
	readonly prompts: {
		readonly discardChanges: string;
	};
	readonly notices: {
		readonly saved: string;
		readonly storageErrors: Readonly<Record<MarkdownStorageErrorCode, string>>;
	};
	readonly languages: Readonly<Record<MarkdownEditorLocale, string>>;
}

const rezics = verbatimTerms.rezics.value;
const markdown = verbatimTerms.markdown.value;
const mdFileExtension = verbatimTerms.mdFileExtension.value;
const markdownFileExtension = verbatimTerms.markdownFileExtension.value;
const mib = verbatimTerms.mib.value;
const utf8 = verbatimTerms.utf8.value;
const productName = `${rezics} ${markdown}`;

const en: MarkdownEditorMessages = {
	locale: "en",
	productName,
	documentTitle: (name, dirty) => `${dirty ? "• " : ""}${name} — ${productName}`,
	untitledName: `Untitled${mdFileExtension}`,
	welcomeDocument: `# ${productName}\n\nA focused local editor with a source-backed live preview. Move the cursor into formatted text to reveal and edit its ${markdown} markers.\n\n## Start here\n\nOpen a local file or begin writing. Your document stays on this device.`,
	labels: {
		application: `${productName} application`,
		documents: "Documents",
		outline: "Outline",
		noOutline: "Add a heading to build the outline.",
		editorToolbar: "Document toolbar",
		formattingToolbar: "Formatting toolbar",
		sourceEditor: `${markdown} source editor`,
		livePreviewEditor: `${markdown} live-preview editor`,
		language: "Language",
		sourceMode: "Source mode",
		livePreviewMode: "Live-preview mode",
	},
	actions: {
		newDocument: "New document",
		open: "Open",
		save: "Save",
		saveAs: "Save as",
		showDocuments: "Show documents",
		showOutline: "Show outline",
		source: "Source",
		livePreview: "Live preview",
		bold: "Bold",
		italic: "Italic",
		strikethrough: "Strikethrough",
		inlineCode: "Inline code",
		heading1: "Heading 1",
		heading2: "Heading 2",
		quote: "Quote",
		bulletList: "Bulleted list",
		numberedList: "Numbered list",
		taskList: "Task list",
		link: "Link",
		table: "Insert table",
		codeBlock: "Insert code block",
		dismiss: "Dismiss",
	},
	status: {
		saved: "Saved",
		unsaved: "Unsaved changes",
		opening: "Opening…",
		saving: "Saving…",
		editorLoading: "Loading editor…",
		words: (count) => `${count} words`,
		characters: (count) => `${count} characters`,
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

const zhHans: MarkdownEditorMessages = {
	locale: "zh-Hans",
	productName,
	documentTitle: (name, dirty) => `${dirty ? "• " : ""}${name} — ${productName}`,
	untitledName: `未命名${mdFileExtension}`,
	welcomeDocument: `# ${productName}\n\n一款专注于本地写作的编辑器，提供以源码为唯一内容来源的实时预览。将光标移入带格式的文字，即可显示并直接编辑 ${markdown} 标记。\n\n## 从这里开始\n\n打开本地文件或直接开始写作。文档只保留在这台设备上。`,
	labels: {
		application: `${productName} 应用`,
		documents: "文档",
		outline: "大纲",
		noOutline: "添加标题后将在这里生成大纲。",
		editorToolbar: "文档工具栏",
		formattingToolbar: "格式工具栏",
		sourceEditor: `${markdown} 源码编辑器`,
		livePreviewEditor: `${markdown} 实时预览编辑器`,
		language: "语言",
		sourceMode: "源码模式",
		livePreviewMode: "实时预览模式",
	},
	actions: {
		newDocument: "新建文档",
		open: "打开",
		save: "保存",
		saveAs: "另存为",
		showDocuments: "显示文档",
		showOutline: "显示大纲",
		source: "源码",
		livePreview: "实时预览",
		bold: "粗体",
		italic: "斜体",
		strikethrough: "删除线",
		inlineCode: "行内代码",
		heading1: "一级标题",
		heading2: "二级标题",
		quote: "引用",
		bulletList: "项目符号列表",
		numberedList: "编号列表",
		taskList: "任务列表",
		link: "链接",
		table: "插入表格",
		codeBlock: "插入代码块",
		dismiss: "关闭",
	},
	status: {
		saved: "已保存",
		unsaved: "有未保存的更改",
		opening: "正在打开…",
		saving: "正在保存…",
		editorLoading: "正在加载编辑器…",
		words: (count) => `${count} 字词`,
		characters: (count) => `${count} 字符`,
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

const zhHant: MarkdownEditorMessages = {
	locale: "zh-Hant",
	productName,
	documentTitle: (name, dirty) => `${dirty ? "• " : ""}${name} — ${productName}`,
	untitledName: `未命名${mdFileExtension}`,
	welcomeDocument: `# ${productName}\n\n一款專注於本機寫作的編輯器，提供以原始碼為唯一內容來源的即時預覽。將游標移入帶格式的文字，即會顯示並可直接編輯 ${markdown} 標記。\n\n## 從這裡開始\n\n開啟本機檔案或直接開始寫作。文件只會留在這台裝置上。`,
	labels: {
		application: `${productName} 應用程式`,
		documents: "文件",
		outline: "大綱",
		noOutline: "加入標題後，這裡會建立大綱。",
		editorToolbar: "文件工具列",
		formattingToolbar: "格式工具列",
		sourceEditor: `${markdown} 原始碼編輯器`,
		livePreviewEditor: `${markdown} 即時預覽編輯器`,
		language: "語言",
		sourceMode: "原始碼模式",
		livePreviewMode: "即時預覽模式",
	},
	actions: {
		newDocument: "新增文件",
		open: "開啟",
		save: "儲存",
		saveAs: "另存新檔",
		showDocuments: "顯示文件",
		showOutline: "顯示大綱",
		source: "原始碼",
		livePreview: "即時預覽",
		bold: "粗體",
		italic: "斜體",
		strikethrough: "刪除線",
		inlineCode: "行內程式碼",
		heading1: "第一層標題",
		heading2: "第二層標題",
		quote: "引言",
		bulletList: "項目符號清單",
		numberedList: "編號清單",
		taskList: "待辦清單",
		link: "連結",
		table: "插入表格",
		codeBlock: "插入程式碼區塊",
		dismiss: "關閉",
	},
	status: {
		saved: "已儲存",
		unsaved: "有未儲存的變更",
		opening: "正在開啟…",
		saving: "正在儲存…",
		editorLoading: "正在載入編輯器…",
		words: (count) => `${count} 個字詞`,
		characters: (count) => `${count} 個字元`,
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

export const markdownEditorMessages: Readonly<
	Record<MarkdownEditorLocale, MarkdownEditorMessages>
> = {
	en,
	"zh-Hans": zhHans,
	"zh-Hant": zhHant,
};

export function resolveMarkdownEditorLocale(value: string | undefined): MarkdownEditorLocale {
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
