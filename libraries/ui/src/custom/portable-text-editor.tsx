"use client";

import {
	defineSchema,
	EditorProvider,
	PortableTextEditable,
	type Editor,
	type EditorSelection,
	type Path,
	type PortableTextBlock as EditorPortableTextBlock,
	type PortableTextTextBlock as EditorPortableTextTextBlock,
	type RenderAnnotationFunction,
	type RenderChildFunction,
	type RenderDecoratorFunction,
	type RenderListItemFunction,
	type RenderStyleFunction,
	useEditor,
	useEditorSelector,
} from "@portabletext/editor";
import * as selectors from "@portabletext/editor/selectors";
import { EventListenerPlugin } from "@portabletext/editor/plugins";
import {
	blockquote,
	bold,
	createKeyboardShortcut,
	h2,
	h3,
	italic,
	normal,
} from "@portabletext/keyboard-shortcuts";
import {
	type ExtendAnnotationSchemaType,
	type ExtendDecoratorSchemaType,
	type ExtendListSchemaType,
	type ExtendStyleSchemaType,
	type ToolbarAnnotationSchemaType,
	type ToolbarDecoratorSchemaType,
	type ToolbarListSchemaType,
	type ToolbarStyleSchemaType,
	useAnnotationButton,
	useDecoratorButton,
	useHistoryButtons,
	useListButton,
	useStyleSelector,
	useToolbarSchema,
} from "@portabletext/toolbar";
import {
	isPortableTextUnitMention,
	normalizePortableText,
	normalizePortableTextUrl,
	type PortableTextValue,
} from "@rezics/portable-text";
import {
	BoldIcon,
	Heading2Icon,
	Heading3Icon,
	ItalicIcon,
	LinkIcon,
	EyeOffIcon,
	ListIcon,
	ListOrderedIcon,
	PilcrowIcon,
	QuoteIcon,
	Redo2Icon,
	SearchIcon,
	Undo2Icon,
} from "lucide-react";
import {
	type FormEvent,
	type KeyboardEvent,
	type ReactElement,
	type ReactNode,
	useEffect,
	useId,
	useMemo,
	useState,
} from "react";

import { Field, FieldError, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { NativeSelect, NativeSelectOption } from "../ui/native-select";
import {
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverFooter,
	PopoverHeader,
	PopoverTrigger,
} from "../ui/popover";
import { Switch } from "../ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "../utils";
import { Button } from "./button";
import { UnitPicker } from "./unit-picker";
import { PortableTextContent } from "./portable-text-content";
import { IdentityAvatar } from "./identity-avatar";
import {
	parsePortableTextSlashToken,
	portableTextMentionSearchCategory,
	type PortableTextMentionPrefix,
} from "./portable-text-slash";
import { type EntityPickerHit, useEntitySearch, useUiMessages } from "./ui-provider";
import { UnitMentionBadge, useUnitMentionPresentations } from "./unit-mention";

export type PortableTextEditorValue = PortableTextValue;
export type PortableTextEditorVariant = "compact" | "document";
export interface PortableTextEditorCapabilities {
	readonly spoilers?: boolean;
}

const editorFrameClassName =
	"overflow-hidden rounded-xl border border-input bg-background shadow-xs/5 outline-none transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring/32 motion-reduce:transition-none!";
const toolbarToggleClassName = "aria-pressed:bg-surface-selected aria-pressed:text-foreground";

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function stripPortableTextSpoilersFromInput(value: unknown): unknown {
	if (!Array.isArray(value)) return value;
	return value.map((block) => {
		if (!isUnknownRecord(block) || block._type !== "block") return block;
		const markDefs = Array.isArray(block.markDefs) ? block.markDefs : [];
		const spoilerKeys = new Set(
			markDefs.flatMap((definition) =>
				isUnknownRecord(definition) &&
				definition._type === "spoiler" &&
				typeof definition._key === "string"
					? [definition._key]
					: [],
			),
		);
		if (spoilerKeys.size === 0) return block;
		return {
			...block,
			children: Array.isArray(block.children)
				? block.children.map((child) =>
						isUnknownRecord(child) && Array.isArray(child.marks)
							? {
									...child,
									marks: child.marks.filter(
										(mark) => typeof mark !== "string" || !spoilerKeys.has(mark),
									),
								}
							: child,
					)
				: block.children,
			markDefs: markDefs.filter(
				(definition) => !isUnknownRecord(definition) || definition._type !== "spoiler",
			),
		};
	});
}

export function normalizePortableTextEditorValue(
	value: unknown,
	capabilities: PortableTextEditorCapabilities | undefined,
): PortableTextValue {
	return normalizePortableText(
		capabilities?.spoilers ? value : stripPortableTextSpoilersFromInput(value),
	);
}

const baseSchemaDefinition = {
	decorators: [{ name: "strong" }, { name: "em" }],
	styles: [{ name: "normal" }, { name: "h2" }, { name: "h3" }, { name: "blockquote" }],
	lists: [{ name: "bullet" }, { name: "number" }],
	inlineObjects: [
		{
			name: "unit-mention",
			fields: [{ name: "unitId", type: "string" }],
		},
	],
	blockObjects: [],
} as const;

const linkAnnotationDefinition = {
	name: "link",
	fields: [
		{ name: "href", type: "string" },
		{ name: "openInNewTab", type: "boolean" },
	],
} as const;

const spoilerAnnotationDefinition = {
	name: "spoiler",
	fields: [{ name: "scopeUnitId", type: "string" }],
} as const;

const standardSchemaDefinition = defineSchema({
	...baseSchemaDefinition,
	annotations: [linkAnnotationDefinition],
});

const spoilerSchemaDefinition = defineSchema({
	...baseSchemaDefinition,
	annotations: [linkAnnotationDefinition, spoilerAnnotationDefinition],
});

const linkShortcut = createKeyboardShortcut({
	default: [{ key: "L", alt: false, ctrl: true, meta: false, shift: false }],
	apple: [{ key: "L", alt: false, ctrl: false, meta: true, shift: false }],
});

const extendDecorator: ExtendDecoratorSchemaType = (decorator) =>
	decorator.name === "strong"
		? { ...decorator, icon: BoldIcon, shortcut: bold }
		: decorator.name === "em"
			? { ...decorator, icon: ItalicIcon, shortcut: italic }
			: decorator;

const extendAnnotation: ExtendAnnotationSchemaType = (annotation) => {
	if (annotation.name === "link")
		return {
			...annotation,
			icon: LinkIcon,
			shortcut: linkShortcut,
			mutuallyExclusive: ["spoiler"],
		};
	if (annotation.name === "spoiler")
		return { ...annotation, icon: EyeOffIcon, mutuallyExclusive: ["link"] };
	return annotation;
};

const extendList: ExtendListSchemaType = (list) =>
	list.name === "bullet"
		? { ...list, icon: ListIcon }
		: list.name === "number"
			? { ...list, icon: ListOrderedIcon }
			: list;

const extendStyle: ExtendStyleSchemaType = (style) =>
	style.name === "normal"
		? { ...style, icon: PilcrowIcon, shortcut: normal }
		: style.name === "h2"
			? { ...style, icon: Heading2Icon, shortcut: h2 }
			: style.name === "h3"
				? { ...style, icon: Heading3Icon, shortcut: h3 }
				: style.name === "blockquote"
					? { ...style, icon: QuoteIcon, shortcut: blockquote }
					: style;

const renderStyle: RenderStyleFunction = ({ schemaType, children }) =>
	schemaType.value === "h2" ? (
		<h2 className="mt-8 pb-2 font-serif font-semibold text-xl leading-tight tracking-tight first:mt-0">
			{children}
		</h2>
	) : schemaType.value === "h3" ? (
		<h3 className="mt-8 font-serif font-semibold text-lg leading-tight tracking-tight first:mt-0">
			{children}
		</h3>
	) : schemaType.value === "blockquote" ? (
		<blockquote className="my-5 border-s-2 border-brand/45 ps-4 text-muted-foreground italic first:mt-0 last:mb-0">
			{children}
		</blockquote>
	) : (
		<p className="my-3 leading-7 first:mt-0 last:mb-0">{children}</p>
	);

const renderListItem: RenderListItemFunction = ({ children }) => (
	<div className="pt-list-item-content">{children}</div>
);

const renderDecorator: RenderDecoratorFunction = ({ value, children }) =>
	value === "strong" ? (
		<strong>{children}</strong>
	) : value === "em" ? (
		<em>{children}</em>
	) : (
		<>{children}</>
	);

const renderAnnotation: RenderAnnotationFunction = ({ schemaType, value, children }) => {
	if (schemaType.name === "spoiler")
		return (
			<span
				className="rounded-sm bg-foreground/10 px-0.5 shadow-[inset_0_-2px_0_0_var(--color-foreground)]"
				data-editor-spoiler
			>
				{children}
			</span>
		);
	const href = normalizePortableTextUrl(value.href);
	if (!href) return <>{children}</>;
	const openInNewTab = value.openInNewTab === true;
	return (
		<a
			className="text-link underline decoration-link/35 underline-offset-4"
			href={href}
			rel={openInNewTab ? "noopener noreferrer" : undefined}
			target={openInNewTab ? "_blank" : undefined}
		>
			{children}
		</a>
	);
};

type SlashRange = {
	readonly path: NonNullable<EditorSelection>["focus"]["path"];
	readonly start: number;
	readonly end: number;
};
type ActiveSlash =
	| {
			readonly kind: "block";
			readonly query: string;
			readonly range: SlashRange;
			readonly position: { readonly left: number; readonly top: number };
	  }
	| {
			readonly kind: "mention";
			readonly prefix: PortableTextMentionPrefix;
			readonly query: string;
			readonly range: SlashRange;
			readonly position: { readonly left: number; readonly top: number };
	  };

function samePath(left: readonly unknown[], right: readonly unknown[]): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function currentCaretPosition(): { left: number; top: number } {
	const nativeSelection = window.getSelection();
	const range =
		nativeSelection && nativeSelection.rangeCount > 0 ? nativeSelection.getRangeAt(0) : undefined;
	const rectangle = range?.getBoundingClientRect();
	const left = Math.max(12, Math.min(rectangle?.left ?? 12, Math.max(12, window.innerWidth - 332)));
	const preferredTop = (rectangle?.bottom ?? 0) + 8;
	return {
		left,
		top: Math.max(12, Math.min(preferredTop, Math.max(12, window.innerHeight - 360))),
	};
}

function readActiveSlash(editor: Editor): ActiveSlash | null {
	const snapshot = editor.getSnapshot();
	const selection = selectors.getSelection(snapshot);
	const focusSpan = selectors.getFocusSpan(snapshot);
	if (
		!selection ||
		!selectors.isSelectionCollapsed(snapshot) ||
		!focusSpan ||
		!samePath(selection.focus.path, focusSpan.path)
	)
		return null;
	const before = focusSpan.node.text.slice(0, selection.focus.offset);
	const token = parsePortableTextSlashToken(before);
	if (!token) return null;
	if (token.kind === "mention") {
		return {
			kind: "mention",
			prefix: token.prefix,
			query: token.query,
			range: {
				path: selection.focus.path,
				start: token.start,
				end: token.end,
			},
			position: currentCaretPosition(),
		};
	}
	return {
		kind: "block",
		query: token.query,
		range: {
			path: selection.focus.path,
			start: token.start,
			end: token.end,
		},
		position: currentCaretPosition(),
	};
}

type BlockSlashCommand = {
	readonly id: string;
	readonly label: string;
	readonly keywords: string;
	readonly apply: (editor: Editor) => void;
};

function deleteSlashToken(editor: Editor, range: SlashRange) {
	editor.send({
		type: "delete.text",
		at: {
			anchor: { path: range.path, offset: range.start },
			focus: { path: range.path, offset: range.end },
		},
	});
}

function SlashCommandEditable({
	ariaLabel,
	ariaLabelledBy,
	required,
	variant,
	presentations,
}: {
	ariaLabel: string;
	ariaLabelledBy?: string;
	required: boolean;
	variant: PortableTextEditorVariant;
	presentations: ReturnType<typeof useUnitMentionPresentations>;
}) {
	const messages = useUiMessages();
	const labels = messages.editor;
	const editor = useEditor();
	const searchEntities = useEntitySearch();
	const [activeSlash, setActiveSlash] = useState<ActiveSlash | null>(null);
	const [hits, setHits] = useState<readonly EntityPickerHit[]>([]);
	const [isPending, setIsPending] = useState(false);
	const [isError, setIsError] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const blockCommands = useMemo<readonly BlockSlashCommand[]>(
		() => [
			{
				id: "paragraph",
				label: labels.paragraph,
				keywords: "paragraph text normal",
				apply: (target) => target.send({ type: "style.toggle", style: "normal" }),
			},
			{
				id: "heading-2",
				label: labels.heading2,
				keywords: "heading title h2",
				apply: (target) => target.send({ type: "style.toggle", style: "h2" }),
			},
			{
				id: "heading-3",
				label: labels.heading3,
				keywords: "heading subtitle h3",
				apply: (target) => target.send({ type: "style.toggle", style: "h3" }),
			},
			{
				id: "quote",
				label: labels.quote,
				keywords: "quote blockquote citation",
				apply: (target) => target.send({ type: "style.toggle", style: "blockquote" }),
			},
			{
				id: "bullet-list",
				label: labels.bulletList,
				keywords: "bullet unordered list",
				apply: (target) => target.send({ type: "list item.toggle", listItem: "bullet" }),
			},
			{
				id: "number-list",
				label: labels.numberedList,
				keywords: "number ordered list",
				apply: (target) => target.send({ type: "list item.toggle", listItem: "number" }),
			},
		],
		[
			labels.bulletList,
			labels.heading2,
			labels.heading3,
			labels.numberedList,
			labels.paragraph,
			labels.quote,
		],
	);
	const filteredBlockCommands =
		activeSlash?.kind === "block"
			? blockCommands.filter((command) => {
					const query = activeSlash.query.trim().toLocaleLowerCase();
					return (
						!query ||
						command.label.toLocaleLowerCase().includes(query) ||
						command.keywords.includes(query)
					);
				})
			: [];
	const itemCount = activeSlash?.kind === "block" ? filteredBlockCommands.length : hits.length;

	useEffect(() => {
		const subscription = editor.on("mutation", () => setActiveSlash(readActiveSlash(editor)), {
			batch: true,
		});
		return () => subscription.unsubscribe();
	}, [editor]);

	useEffect(() => {
		if (activeSlash?.kind !== "mention" || !searchEntities) {
			setHits([]);
			setIsPending(false);
			setIsError(false);
			return;
		}
		const query = activeSlash.query.trim();
		if (!query) {
			setHits([]);
			setIsPending(false);
			setIsError(false);
			return;
		}
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			setIsPending(true);
			setIsError(false);
			void searchEntities(
				portableTextMentionSearchCategory(activeSlash.prefix),
				query,
				controller.signal,
			)
				.then(
					(items) => {
						if (controller.signal.aborted) return;
						setHits(
							activeSlash.prefix === "z" ? items.filter((item) => item.kind === "zone") : items,
						);
					},
					() => {
						if (!controller.signal.aborted) {
							setHits([]);
							setIsError(true);
						}
					},
				)
				.finally(() => {
					if (!controller.signal.aborted) setIsPending(false);
				});
		}, 180);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [activeSlash, searchEntities]);

	useEffect(() => {
		setActiveIndex((index) => Math.min(index, Math.max(0, itemCount - 1)));
	}, [itemCount]);

	function chooseBlock(command: BlockSlashCommand) {
		if (activeSlash?.kind !== "block") return;
		deleteSlashToken(editor, activeSlash.range);
		command.apply(editor);
		editor.send({ type: "focus" });
		setActiveSlash(null);
	}

	function chooseMention(hit: EntityPickerHit) {
		if (activeSlash?.kind !== "mention") return;
		deleteSlashToken(editor, activeSlash.range);
		editor.send({
			type: "insert.inline object",
			inlineObject: { name: "unit-mention", value: { unitId: hit.id } },
		});
		editor.send({ type: "insert.span", text: " " });
		editor.send({ type: "focus" });
		setActiveSlash(null);
	}

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.nativeEvent.isComposing) return;
		if (!activeSlash) return;
		if (event.key === "Escape") {
			event.preventDefault();
			setActiveSlash(null);
			return;
		}
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (itemCount === 0) return;
			setActiveIndex((index) =>
				event.key === "ArrowDown" ? (index + 1) % itemCount : (index - 1 + itemCount) % itemCount,
			);
			return;
		}
		if (event.key !== "Enter" || itemCount === 0) return;
		event.preventDefault();
		if (activeSlash.kind === "block") {
			const command = filteredBlockCommands[activeIndex];
			if (command) chooseBlock(command);
		} else {
			const hit = hits[activeIndex];
			if (hit) chooseMention(hit);
		}
	}

	function handleKeyUp(event: KeyboardEvent<HTMLDivElement>) {
		if (event.nativeEvent.isComposing) return;
		if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;
		setActiveSlash(readActiveSlash(editor));
	}

	const mentionGroupLabel =
		activeSlash?.kind === "mention"
			? {
					u: labels.mentionUsers,
					t: labels.mentionTags,
					e: labels.mentionEntities,
					r: labels.mentionRealms,
					z: labels.mentionZones,
				}[activeSlash.prefix]
			: undefined;
	const renderChild: RenderChildFunction = ({ value, children }) =>
		isPortableTextUnitMention(value) ? (
			<span>
				{children}
				<UnitMentionBadge presentation={presentations.get(value.unitId)} value={value} />
			</span>
		) : (
			children
		);

	return (
		<>
			<PortableTextEditable
				aria-label={ariaLabelledBy ? undefined : ariaLabel}
				aria-labelledby={ariaLabelledBy}
				aria-required={required}
				className={cn(
					"portable-text-editor-surface max-w-none overflow-y-auto px-5 py-4 font-sans outline-none sm:px-6 sm:py-5",
					"[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:ps-6 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:ps-6",
					"focus-visible:outline-none",
					variant === "document" ? "min-h-[30rem] text-base" : "min-h-44 text-[15px]",
				)}
				onBlur={() => setActiveSlash(null)}
				onClick={() => setActiveSlash(readActiveSlash(editor))}
				onKeyDown={handleKeyDown}
				onKeyUp={handleKeyUp}
				renderAnnotation={renderAnnotation}
				renderChild={renderChild}
				renderDecorator={renderDecorator}
				renderListItem={renderListItem}
				renderPlaceholder={() => (
					<span className="inline-block ps-5 text-muted-foreground sm:ps-6">
						{labels.placeholder}
					</span>
				)}
				renderStyle={renderStyle}
			/>
			{activeSlash ? (
				<div
					aria-label={labels.slashMenu}
					className="fixed z-[100] w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
					role="listbox"
					style={{ left: activeSlash.position.left, top: activeSlash.position.top }}
				>
					<div className="flex items-center gap-2 border-b px-3 py-2 text-muted-foreground text-xs">
						<SearchIcon className="size-3.5" />
						<span>{mentionGroupLabel ?? labels.slashMenu}</span>
						<span className="ms-auto font-mono">
							{activeSlash.kind === "mention" ? `${activeSlash.prefix}/` : "/"}
						</span>
					</div>
					<div className="max-h-72 overflow-y-auto p-1.5">
						{activeSlash.kind === "block"
							? filteredBlockCommands.map((command, index) => (
									<button
										aria-selected={index === activeIndex}
										className="flex w-full items-center rounded-lg px-3 py-2 text-start text-sm aria-selected:bg-surface-selected"
										key={command.id}
										onMouseDown={(event) => {
											event.preventDefault();
											chooseBlock(command);
										}}
										role="option"
										type="button"
									>
										{command.label}
									</button>
								))
							: hits.map((hit, index) => (
									<button
										aria-selected={index === activeIndex}
										className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm aria-selected:bg-surface-selected"
										key={hit.id}
										onMouseDown={(event) => {
											event.preventDefault();
											chooseMention(hit);
										}}
										role="option"
										type="button"
									>
										<IdentityAvatar
											avatar={hit.avatar}
											className="size-7 shrink-0"
											fallback={(hit.label || "?").slice(0, 1).toUpperCase()}
										/>
										<span className="min-w-0 flex-1 truncate">{hit.label || messages.unnamed}</span>
									</button>
								))}
						{isPending ? (
							<p className="px-3 py-2 text-muted-foreground text-sm">{messages.loading}</p>
						) : null}
						{isError ? (
							<p className="px-3 py-2 text-destructive text-sm" role="alert">
								{messages.error}
							</p>
						) : null}
						{!isPending && !isError && itemCount === 0 ? (
							<p className="px-3 py-2 text-muted-foreground text-sm">
								{activeSlash.kind === "mention" && !activeSlash.query.trim()
									? labels.mentionSearchPrompt
									: messages.empty}
							</p>
						) : null}
					</div>
				</div>
			) : null}
		</>
	);
}

function ToolbarTooltip({ label, children }: { label: string; children: ReactNode }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function ToolbarPopoverTrigger({ label, children }: { label: string; children: ReactElement }) {
	return (
		<ToolbarTooltip label={label}>
			<span className="inline-flex shrink-0">
				<PopoverTrigger asChild>{children}</PopoverTrigger>
			</span>
		</ToolbarTooltip>
	);
}

function HistoryButtons() {
	const { editor: labels } = useUiMessages();
	const history = useHistoryButtons();
	const disabled = history.snapshot.matches("disabled");

	return (
		<div className="flex items-center gap-0.5" role="group">
			<ToolbarTooltip label={labels.undo}>
				<Button
					aria-label={labels.undo}
					disabled={disabled}
					onClick={() => history.send({ type: "history.undo" })}
					size="icon-sm"
					variant="quiet"
				>
					<Undo2Icon />
				</Button>
			</ToolbarTooltip>
			<ToolbarTooltip label={labels.redo}>
				<Button
					aria-label={labels.redo}
					disabled={disabled}
					onClick={() => history.send({ type: "history.redo" })}
					size="icon-sm"
					variant="quiet"
				>
					<Redo2Icon />
				</Button>
			</ToolbarTooltip>
		</div>
	);
}

function StyleSelector({ schemaTypes }: { schemaTypes: readonly ToolbarStyleSchemaType[] }) {
	const { editor: labels } = useUiMessages();
	const selector = useStyleSelector({ schemaTypes });
	const id = useId();
	const names: Record<string, string> = {
		normal: labels.paragraph,
		h2: labels.heading2,
		h3: labels.heading3,
		blockquote: labels.quote,
	};

	return (
		<NativeSelect
			aria-label={labels.style}
			className="w-32 shrink-0 [&_[data-slot=native-select]]:border-transparent [&_[data-slot=native-select]]:shadow-none [&_[data-slot=native-select]]:hover:bg-surface-hover dark:[&_[data-slot=native-select]]:bg-transparent"
			disabled={selector.snapshot.matches("disabled")}
			id={id}
			onChange={(event) => selector.send({ type: "toggle", style: event.target.value })}
			size="sm"
			value={selector.snapshot.context.activeStyle ?? "normal"}
		>
			{schemaTypes.map((schemaType) => (
				<NativeSelectOption key={schemaType.name} value={schemaType.name}>
					{names[schemaType.name] ?? schemaType.name}
				</NativeSelectOption>
			))}
		</NativeSelect>
	);
}

function DecoratorButton({ schemaType }: { schemaType: ToolbarDecoratorSchemaType }) {
	const { editor: labels } = useUiMessages();
	const button = useDecoratorButton({ schemaType });
	const active =
		button.snapshot.matches({ disabled: "active" }) ||
		button.snapshot.matches({ enabled: "active" });
	const label = schemaType.name === "strong" ? labels.bold : labels.italic;
	const Icon = schemaType.icon;

	return (
		<ToolbarTooltip label={label}>
			<Button
				aria-label={label}
				aria-pressed={active}
				className={toolbarToggleClassName}
				disabled={button.snapshot.matches("disabled")}
				onClick={() => button.send({ type: "toggle" })}
				size="icon-sm"
				variant="quiet"
			>
				{Icon ? <Icon /> : label}
			</Button>
		</ToolbarTooltip>
	);
}

function ListButton({ schemaType }: { schemaType: ToolbarListSchemaType }) {
	const { editor: labels } = useUiMessages();
	const button = useListButton({ schemaType });
	const active =
		button.snapshot.matches({ disabled: "active" }) ||
		button.snapshot.matches({ enabled: "active" });
	const label = schemaType.name === "bullet" ? labels.bulletList : labels.numberedList;
	const Icon = schemaType.icon;

	return (
		<ToolbarTooltip label={label}>
			<Button
				aria-label={label}
				aria-pressed={active}
				className={toolbarToggleClassName}
				disabled={button.snapshot.matches("disabled")}
				onClick={() => button.send({ type: "toggle" })}
				size="icon-sm"
				variant="quiet"
			>
				{Icon ? <Icon /> : label}
			</Button>
		</ToolbarTooltip>
	);
}

type SpoilerRange = "selection" | "blocks" | "body";
type TextBlockEntry = {
	readonly node: EditorPortableTextTextBlock;
	readonly path: Path;
};

type EditorTextSpan = {
	readonly _key: string;
	readonly _type: "span";
	readonly marks?: readonly string[];
	readonly text: string;
};

function isSpoilerRange(value: string): value is SpoilerRange {
	return value === "selection" || value === "blocks" || value === "body";
}

function isEditorTextSpan(value: unknown): value is EditorTextSpan {
	if (!isUnknownRecord(value)) return false;
	return (
		value._type === "span" &&
		typeof value._key === "string" &&
		typeof value.text === "string" &&
		(value.marks === undefined ||
			(Array.isArray(value.marks) && value.marks.every((mark) => typeof mark === "string")))
	);
}

function isEditorTextBlock(block: EditorPortableTextBlock): block is EditorPortableTextTextBlock {
	return block._type === "block" && Array.isArray(block.children);
}

function rootTextBlockEntries(value: readonly EditorPortableTextBlock[]): TextBlockEntry[] {
	return value.flatMap((block): TextBlockEntry[] =>
		isEditorTextBlock(block) ? [{ node: block, path: [{ _key: block._key }] }] : [],
	);
}

function selectionForTextBlocks(
	blocks: readonly TextBlockEntry[],
): NonNullable<EditorSelection> | null {
	const points = blocks.flatMap(({ node, path }) =>
		node.children.flatMap((child) =>
			isEditorTextSpan(child) && child.text.length > 0
				? [
						{
							path: [...path, "children", { _key: child._key }],
							start: 0,
							end: child.text.length,
						},
					]
				: [],
		),
	);
	const first = points[0];
	const last = points.at(-1);
	if (!first || !last) return null;
	return {
		anchor: { path: first.path, offset: first.start },
		focus: { path: last.path, offset: last.end },
	};
}

function textBlocksContainAnnotation(
	blocks: readonly TextBlockEntry[],
	annotationType: string,
): boolean {
	return blocks.some(({ node }) => {
		const annotationKeys = new Set(
			(node.markDefs ?? []).flatMap((definition) =>
				definition._type === annotationType ? [definition._key] : [],
			),
		);
		return (
			annotationKeys.size > 0 &&
			node.children.some(
				(child) =>
					isEditorTextSpan(child) && (child.marks ?? []).some((mark) => annotationKeys.has(mark)),
			)
		);
	});
}

function LinkButton({ schemaType }: { schemaType: ToolbarAnnotationSchemaType }) {
	const { editor: labels } = useUiMessages();
	const editor = useEditor();
	const button = useAnnotationButton({ schemaType });
	const spoilerActive = useEditorSelector(
		editor,
		selectors.isActiveAnnotation("spoiler", { mode: "partial" }),
	);
	const hrefId = useId();
	const openInNewTabInputId = useId();
	const openInNewTabLabelId = useId();
	const [href, setHref] = useState("");
	const [openInNewTab, setOpenInNewTab] = useState(false);
	const [error, setError] = useState(false);
	const active =
		button.snapshot.matches({ disabled: "active" }) ||
		button.snapshot.matches({ enabled: "active" });
	const open = button.snapshot.matches({ enabled: { inactive: "showing dialog" } });

	if (active) {
		return (
			<ToolbarTooltip label={labels.removeLink}>
				<Button
					aria-label={labels.removeLink}
					aria-pressed
					className={toolbarToggleClassName}
					disabled={button.snapshot.matches("disabled")}
					onClick={() => button.send({ type: "remove" })}
					size="icon-sm"
					variant="quiet"
				>
					<LinkIcon />
				</Button>
			</ToolbarTooltip>
		);
	}

	function close() {
		button.send({ type: "close dialog" });
		setHref("");
		setOpenInNewTab(false);
		setError(false);
	}

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		event.stopPropagation();
		const normalizedHref = normalizePortableTextUrl(href);
		if (!normalizedHref) {
			setError(true);
			return;
		}
		button.send({
			type: "add",
			annotation: { value: { href: normalizedHref, openInNewTab } },
		});
		setHref("");
		setOpenInNewTab(false);
		setError(false);
	}

	return (
		<Popover
			modal={false}
			onOpenChange={({ open: nextOpen }) => {
				if (nextOpen) button.send({ type: "open dialog" });
				else if (open) close();
			}}
			open={open}
			positioning={{ placement: "bottom-start", gutter: 6 }}
		>
			<ToolbarPopoverTrigger label={spoilerActive ? labels.spoilerLinkConflict : labels.addLink}>
				<Button
					aria-label={labels.addLink}
					disabled={button.snapshot.matches("disabled") || spoilerActive}
					size="icon-sm"
					variant="quiet"
				>
					<LinkIcon />
				</Button>
			</ToolbarPopoverTrigger>
			<PopoverContent className="w-[min(22rem,calc(100vw-2rem))]">
				<form onSubmit={submit}>
					<PopoverHeader description={labels.linkPrompt} title={labels.addLink} />
					<PopoverBody className="grid gap-4">
						<Field invalid={error}>
							<FieldLabel htmlFor={hrefId}>{labels.linkUrl}</FieldLabel>
							<Input
								autoFocus
								id={hrefId}
								onChange={(event) => {
									setHref(event.target.value);
									setError(false);
								}}
								placeholder="https://"
								value={href}
							/>
							{error ? <FieldError>{labels.invalidLink}</FieldError> : null}
						</Field>
						<div className="flex min-h-11 items-center justify-between gap-4 text-sm">
							<label
								className="flex min-h-11 flex-1 cursor-pointer items-center"
								htmlFor={openInNewTabInputId}
								id={openInNewTabLabelId}
							>
								{labels.openInNewTab}
							</label>
							<Switch
								checked={openInNewTab}
								ids={{
									hiddenInput: openInNewTabInputId,
									label: openInNewTabLabelId,
								}}
								onCheckedChange={({ checked }) => setOpenInNewTab(checked)}
							/>
						</div>
					</PopoverBody>
					<PopoverFooter>
						<Button variant="solid" type="submit">
							{labels.addLink}
						</Button>
					</PopoverFooter>
				</form>
			</PopoverContent>
		</Popover>
	);
}

function SpoilerButton({ schemaType }: { schemaType: ToolbarAnnotationSchemaType }) {
	const { editor: labels } = useUiMessages();
	const editor = useEditor();
	const button = useAnnotationButton({ schemaType });
	const selection = useEditorSelector(editor, selectors.getSelection);
	const selectionExpanded = useEditorSelector(editor, selectors.isSelectionExpanded);
	const selectedBlocks = useEditorSelector(editor, selectors.getSelectedTextBlocks);
	const value = useEditorSelector(editor, selectors.getValue);
	const linkActive = useEditorSelector(
		editor,
		selectors.isActiveAnnotation("link", { mode: "partial" }),
	);
	const spoilerActive = useEditorSelector(
		editor,
		selectors.isActiveAnnotation("spoiler", { mode: "partial" }),
	);
	const [range, setRange] = useState<SpoilerRange>("selection");
	const [scopeUnitId, setScopeUnitId] = useState<string>();
	const rangeId = useId();
	const active =
		button.snapshot.matches({ disabled: "active" }) ||
		button.snapshot.matches({ enabled: "active" });
	const open = button.snapshot.matches({ enabled: { inactive: "showing dialog" } });
	const bodyBlocks = rootTextBlockEntries(value);
	const targetBlocks = range === "blocks" ? selectedBlocks : bodyBlocks;
	const targetSelection =
		range === "selection"
			? selectionExpanded
				? selection
				: null
			: selectionForTextBlocks(targetBlocks);
	const targetHasSpoiler =
		range === "selection" ? spoilerActive : textBlocksContainAnnotation(targetBlocks, "spoiler");
	const hasLinkConflict =
		!targetHasSpoiler &&
		(range === "selection" ? linkActive : textBlocksContainAnnotation(targetBlocks, "link"));
	const canSubmit = targetSelection !== null && !hasLinkConflict;

	if (active) {
		return (
			<ToolbarTooltip label={labels.removeSpoiler}>
				<Button
					aria-label={labels.removeSpoiler}
					aria-pressed
					className={toolbarToggleClassName}
					disabled={button.snapshot.matches("disabled")}
					onClick={() => button.send({ type: "remove" })}
					size="icon-sm"
					variant="quiet"
				>
					<EyeOffIcon />
				</Button>
			</ToolbarTooltip>
		);
	}

	function close() {
		button.send({ type: "close dialog" });
		setRange("selection");
		setScopeUnitId(undefined);
	}

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		event.stopPropagation();
		if (!targetSelection || hasLinkConflict) return;
		if (targetHasSpoiler)
			editor.send({
				type: "annotation.remove",
				annotation: { name: "spoiler" },
				at: targetSelection,
			});
		else
			editor.send({
				type: "annotation.add",
				annotation: {
					name: "spoiler",
					value: scopeUnitId ? { scopeUnitId } : {},
				},
				at: targetSelection,
			});
		close();
		editor.send({ type: "focus" });
	}

	return (
		<Popover
			modal={false}
			onOpenChange={({ open: nextOpen }) => {
				if (nextOpen) button.send({ type: "open dialog" });
				else if (open) close();
			}}
			open={open}
			positioning={{ placement: "bottom-start", gutter: 6 }}
		>
			<ToolbarPopoverTrigger label={linkActive ? labels.spoilerLinkConflict : labels.addSpoiler}>
				<Button
					aria-label={labels.addSpoiler}
					disabled={button.snapshot.matches("disabled") || linkActive}
					size="icon-sm"
					variant="quiet"
				>
					<EyeOffIcon />
				</Button>
			</ToolbarPopoverTrigger>
			<PopoverContent className="w-[min(24rem,calc(100vw-2rem))]">
				<form onSubmit={submit}>
					<PopoverHeader title={targetHasSpoiler ? labels.removeSpoiler : labels.addSpoiler} />
					<PopoverBody className="grid gap-4">
						<div className="grid gap-1.5">
							<label className="font-medium text-sm" htmlFor={rangeId}>
								{labels.spoilerRange}
							</label>
							<NativeSelect
								className="w-full"
								id={rangeId}
								onChange={(event) => {
									if (isSpoilerRange(event.target.value)) setRange(event.target.value);
								}}
								value={range}
							>
								<NativeSelectOption value="selection">
									{labels.spoilerRangeSelection}
								</NativeSelectOption>
								<NativeSelectOption value="blocks">{labels.spoilerRangeBlocks}</NativeSelectOption>
								<NativeSelectOption value="body">{labels.spoilerRangeBody}</NativeSelectOption>
							</NativeSelect>
						</div>
						{targetHasSpoiler ? null : (
							<div className="grid gap-1.5">
								<span className="font-medium text-sm">{labels.spoilerScope}</span>
								<UnitPicker
									ariaLabel={labels.spoilerScope}
									onValueChange={setScopeUnitId}
									placeholder={labels.spoilerScopePlaceholder}
									value={scopeUnitId}
								/>
							</div>
						)}
						<p className="text-muted-foreground text-xs">{labels.spoilerTextOnlyHint}</p>
						{hasLinkConflict ? (
							<p className="text-destructive text-sm" role="alert">
								{labels.spoilerLinkConflict}
							</p>
						) : null}
					</PopoverBody>
					<PopoverFooter>
						<Button disabled={!canSubmit} type="submit" variant="solid">
							{targetHasSpoiler ? labels.removeSpoiler : labels.addSpoiler}
						</Button>
					</PopoverFooter>
				</form>
			</PopoverContent>
		</Popover>
	);
}

function Toolbar({ variant }: { variant: PortableTextEditorVariant }) {
	const { editor: labels } = useUiMessages();
	const schema = useToolbarSchema({
		extendAnnotation,
		extendDecorator,
		extendList,
		extendStyle,
	});

	return (
		<div
			aria-label={labels.toolbar}
			className="flex min-h-11 items-center gap-1 overflow-x-auto overscroll-x-contain border-border-weak border-b bg-muted/20 px-2 py-1.5 [scrollbar-width:thin]"
			role="toolbar"
		>
			{variant === "document" ? <HistoryButtons /> : null}
			{variant === "document" ? (
				<span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border-weak" />
			) : null}
			<StyleSelector schemaTypes={schema.styles} />
			<span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border-weak" />
			<div className="flex shrink-0 items-center gap-0.5">
				{schema.decorators.map((schemaType) => (
					<DecoratorButton key={schemaType.name} schemaType={schemaType} />
				))}
				{schema.annotations.map((schemaType) =>
					schemaType.name === "spoiler" ? (
						<SpoilerButton key={schemaType.name} schemaType={schemaType} />
					) : (
						<LinkButton key={schemaType.name} schemaType={schemaType} />
					),
				)}
			</div>
			<span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border-weak" />
			<div className="flex shrink-0 items-center gap-0.5">
				{schema.lists.map((schemaType) => (
					<ListButton key={schemaType.name} schemaType={schemaType} />
				))}
			</div>
		</div>
	);
}

function EditorSurface({
	value,
	onChange,
	variant,
	capabilities,
	ariaLabel,
	ariaLabelledBy,
	required,
	presentations,
}: {
	value: PortableTextEditorValue;
	onChange: (value: PortableTextEditorValue) => void;
	variant: PortableTextEditorVariant;
	capabilities: PortableTextEditorCapabilities | undefined;
	ariaLabel: string;
	ariaLabelledBy?: string;
	required: boolean;
	presentations: ReturnType<typeof useUnitMentionPresentations>;
}) {
	const { editor: labels } = useUiMessages();
	const schemaDefinition = capabilities?.spoilers
		? spoilerSchemaDefinition
		: standardSchemaDefinition;
	return (
		<EditorProvider initialConfig={{ schemaDefinition, initialValue: value }}>
			<EventListenerPlugin
				on={(event) => {
					if (event.type === "mutation")
						onChange(normalizePortableTextEditorValue(event.value, capabilities));
				}}
			/>
			<Toolbar variant={variant} />
			<SlashCommandEditable
				ariaLabel={ariaLabel}
				ariaLabelledBy={ariaLabelledBy}
				presentations={presentations}
				required={required}
				variant={variant}
			/>
			<div className="border-border-weak border-t bg-muted/15 px-4 py-1.5 text-muted-foreground text-xs">
				{labels.slashHint}
			</div>
		</EditorProvider>
	);
}

export function PortableTextEditor({
	value,
	onChange,
	variant = "compact",
	ariaLabel,
	className,
	label,
	required = false,
	capabilities,
}: {
	value: PortableTextEditorValue;
	onChange: (value: PortableTextEditorValue) => void;
	variant?: PortableTextEditorVariant;
	ariaLabel?: string;
	className?: string;
	label?: string;
	required?: boolean;
	capabilities?: PortableTextEditorCapabilities;
}) {
	const { editor: labels } = useUiMessages();
	const normalized = normalizePortableTextEditorValue(value, capabilities);
	const presentations = useUnitMentionPresentations(normalized);
	const labelId = useId();
	const accessibleLabel = label ?? ariaLabel ?? labels.richText;
	const frameLabel = label ? { "aria-labelledby": labelId } : { "aria-label": accessibleLabel };
	const surface = (surfaceVariant: PortableTextEditorVariant) => (
		<EditorSurface
			ariaLabel={accessibleLabel}
			ariaLabelledBy={label ? labelId : undefined}
			capabilities={capabilities}
			onChange={onChange}
			presentations={presentations}
			required={required}
			value={normalized}
			variant={surfaceVariant}
		/>
	);

	if (variant === "document") {
		return (
			<div className="grid gap-2">
				{label ? <EditorLabel id={labelId} label={label} required={required} /> : null}
				<div
					{...frameLabel}
					aria-required={required}
					className={cn("grid lg:grid-cols-2", editorFrameClassName, className)}
					role="group"
				>
					<div className="min-w-0 border-border-weak border-b lg:border-e lg:border-b-0">
						{surface(variant)}
					</div>
					<section className="min-w-0 bg-muted/10" aria-label={labels.preview}>
						<div className="flex min-h-11 items-center border-border-weak border-b bg-muted/20 px-5 font-medium text-muted-foreground text-sm">
							{labels.preview}
						</div>
						<div className="max-h-[36rem] overflow-y-auto px-6 py-5 sm:px-8 sm:py-7">
							<PortableTextContent
								unitMentionPresentations={presentations}
								value={normalized}
								variant="article"
							/>
						</div>
					</section>
				</div>
			</div>
		);
	}

	return (
		<div className="grid gap-2">
			{label ? <EditorLabel id={labelId} label={label} required={required} /> : null}
			<div
				{...frameLabel}
				aria-required={required}
				className={cn(editorFrameClassName, className)}
				role="group"
			>
				{surface(variant)}
			</div>
		</div>
	);
}

function EditorLabel({ id, label, required }: { id: string; label: string; required: boolean }) {
	return (
		<div className="flex items-center gap-1 font-medium text-sm leading-snug" id={id}>
			{label}
			{required ? (
				<span aria-hidden className="text-destructive">
					*
				</span>
			) : null}
		</div>
	);
}
