import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { insert } from "native-i18n";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}、${verbatimTerms.png.value}、${verbatimTerms.webp.value} 或 ${verbatimTerms.avif.value}`;

export default {
	choose: "选择、拖入或粘贴图片",
	hint: `${SupportedImageFormats}，最大 10 ${verbatimTerms.mib.value}`,
	replace: "取代",
	remove: "移除",
	cancel: "取消",
	invalid: `请选择不超过 10 ${verbatimTerms.mib.value} 的 ${SupportedImageFormats} 图片。`,
	current: "当前语言的封面图片",
	displayPreview: "实际显示范围",
	editPresentation: "调整显示范围",
	upload: {
		preparing: "正在准备上传图片……",
		uploading: "正在上传图片……",
		progress: insert("正在上传图片……{{percentage}}%", { percentage: Number }),
		processing: "上传完成，正在处理图片……",
	},
	localizationFallback: {
		notice: "所有图片资源都会独立应用语言递补规则。",
		title: "图片语言递补规则",
		description: "头像、横幅和封面会分别解析，不受文字内容所选语言限制。",
		viewerPreferences:
			"显示图片时，系统会先按每位用户的语言偏好查找。如果某种语言未设置该图片，则会跳过并继续查找下一个偏好语言。",
		defaultOrder: "如果用户偏好的语言都未设置该图片，系统会继续按照内容的默认语言顺序查找。",
		noImage: "如果所有语言都未设置，则不会返回本地化图片。",
		textDifference:
			"文字内容的规则不同：系统会选择一个完整的语言版本，标题、摘要和描述不会分别从不同语言递补。",
		example:
			"例如，用户偏好中文、英文，而中文有文字和横幅但没有头像，英文有头像；用户会看到中文文字、中文横幅和英文头像。",
		close: "关闭图片语言递补规则",
	},
	presentationEditor: {
		title: {
			avatar: "调整头像",
			banner: "调整横幅",
			cover: "调整封面",
		},
		description: {
			avatar: "在正方形裁切框内拖动及缩放图片；圆形头像只是一层预览遮罩，不会删除原图四角。",
			banner: "在固定 4:1 裁切框内拖动及缩放图片；新横幅默认从左上角取景。",
			cover: "默认完整显示图片；若构图比完整内容更重要，也可以切换成固定 3:4 裁切。",
		},
		close: "关闭图片调整",
		loading: "正在加载原始图片……",
		loadFailed: "无法加载原始图片或它的显示设置。",
		cropArea: "图片裁切范围。拖动可以重新取景，鼠标滚轮可以缩放，方向键可以移动。",
		zoom: "缩放",
		zoomIn: "放大",
		zoomOut: "缩小",
		reset: "重设",
		avatarPreview: "圆形预览",
		bannerPreview: "横幅预览",
		coverPreview: "完整封面预览",
		coverMode: {
			label: "封面显示模式",
			contain: "完整显示图片",
			crop: "裁切成 3:4",
			containDescription: "完整图片都会保留；比例不同时，外框会使用模糊背景补足。",
			cropDescription: "只会发送并显示选取的 3:4 区域。",
		},
		cancel: "取消",
		save: "保存显示范围",
		saveFailed: "无法保存显示范围，请重试。",
	},
	avatarPicker: {
		setup: "设置头像",
		edit: "编辑头像",
		dialogTitle: "选择头像",
		dialogDescription: "上传图片，或选择图标或表情符号。",
		close: "关闭头像选择器",
		source: "头像来源",
		useInherited: "使用继承头像",
		recent: "最近使用",
		typeLabel: "头像类型",
		tabs: { image: "图片", icon: "图标", emoji: "表情符号" },
		preview: "头像预览",
		icon: {
			search: "搜索图标",
			featured: "常用图标",
			style: "图标样式",
			styles: { fas: "实心", fab: "品牌" },
			loading: "正在搜索图标……",
			empty: "找不到相符的图标。",
			failed: "当前无法搜索图标，请稍后再试。",
			select: insert("选择图标：{{name}}", { name: String }),
			unconfigured: `${verbatimTerms.fontAwesome.value} ${verbatimTerms.cdn.value} 尚未设置，因此无法显示图标预览。`,
		},
		emoji: {
			search: "搜索表情符号",
			skinTone: "切换肤色",
			loading: "正在加载表情符号……",
			empty: "找不到相符的表情符号。",
		},
	},
	bannerPreview: {
		description: "实际发送的横幅会使用已保存的 4:1 范围。",
		showOriginal: "查看完整图片",
		hideOriginal: "隐藏完整图片",
		original: "完整图片",
	},
	roles: {
		avatar: {
			title: "头像",
			inherit: "依照在地化顺序使用第一个可用头像",
			failed: "头像上传失败，请重试。",
		},
		banner: {
			title: "横幅",
			inherit: "依照在地化顺序使用第一个可用横幅",
			failed: "横幅上传失败，请重试。",
		},
		cover: {
			title: "封面",
			inherit: "依照在地化顺序使用第一个可用封面",
			failed: "封面上传失败，请重试。",
		},
	},
} satisfies typeof import("../zh-Hant/media").default;
