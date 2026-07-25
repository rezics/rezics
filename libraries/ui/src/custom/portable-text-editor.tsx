"use client";

import {
	defineSchema,
	EditorProvider,
	PortableTextEditable,
	type RenderAnnotationFunction,
	type RenderDecoratorFunction,
	type RenderStyleFunction,
} from "@portabletext/editor";
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
	ListIcon,
	ListOrderedIcon,
	PilcrowIcon,
	QuoteIcon,
	Redo2Icon,
	Undo2Icon,
} from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";

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
import { PortableTextContent } from "./portable-text-content";
import { useUiMessages } from "./ui-provider";

export type PortableTextEditorValue = PortableTextValue;
export type PortableTextEditorVariant = "compact" | "document";

const editorFrameClassName =
	"overflow-hidden rounded-xl border border-input bg-background shadow-xs/5 outline-none transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring/32 motion-reduce:transition-none!";
const toolbarToggleClassName = "aria-pressed:bg-surface-selected aria-pressed:text-foreground";

const schemaDefinition = defineSchema({
	decorators: [{ name: "strong" }, { name: "em" }],
	styles: [{ name: "normal" }, { name: "h2" }, { name: "h3" }, { name: "blockquote" }],
	lists: [{ name: "bullet" }, { name: "number" }],
	annotations: [
		{
			name: "link",
			fields: [
				{ name: "href", type: "string" },
				{ name: "openInNewTab", type: "boolean" },
			],
		},
	],
	inlineObjects: [],
	blockObjects: [],
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

const extendAnnotation: ExtendAnnotationSchemaType = (annotation) =>
	annotation.name === "link"
		? { ...annotation, icon: LinkIcon, shortcut: linkShortcut }
		: annotation;

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

const renderDecorator: RenderDecoratorFunction = ({ value, children }) =>
	value === "strong" ? (
		<strong>{children}</strong>
	) : value === "em" ? (
		<em>{children}</em>
	) : (
		<>{children}</>
	);

const renderAnnotation: RenderAnnotationFunction = ({ value, children }) => {
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

function ToolbarTooltip({ label, children }: { label: string; children: ReactNode }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
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

function LinkButton({ schemaType }: { schemaType: ToolbarAnnotationSchemaType }) {
	const { editor: labels } = useUiMessages();
	const button = useAnnotationButton({ schemaType });
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
			positioning={{ placement: "bottom-start" }}
		>
			<ToolbarTooltip label={labels.addLink}>
				<PopoverTrigger asChild>
					<Button
						aria-label={labels.addLink}
						disabled={button.snapshot.matches("disabled")}
						size="icon-sm"
						variant="quiet"
					>
						<LinkIcon />
					</Button>
				</PopoverTrigger>
			</ToolbarTooltip>
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

function Toolbar({ variant }: { variant: PortableTextEditorVariant }) {
	const schema = useToolbarSchema({
		extendAnnotation,
		extendDecorator,
		extendList,
		extendStyle,
	});

	return (
		<div
			aria-label="Portable Text"
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
				{schema.annotations.map((schemaType) => (
					<LinkButton key={schemaType.name} schemaType={schemaType} />
				))}
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
	ariaLabel,
	ariaLabelledBy,
	required,
}: {
	value: PortableTextEditorValue;
	onChange: (value: PortableTextEditorValue) => void;
	variant: PortableTextEditorVariant;
	ariaLabel: string;
	ariaLabelledBy?: string;
	required: boolean;
}) {
	return (
		<EditorProvider initialConfig={{ schemaDefinition, initialValue: value }}>
			<EventListenerPlugin
				on={(event) => {
					if (event.type === "mutation") onChange(normalizePortableText(event.value));
				}}
			/>
			<Toolbar variant={variant} />
			<PortableTextEditable
				aria-label={ariaLabelledBy ? undefined : ariaLabel}
				aria-labelledby={ariaLabelledBy}
				aria-required={required}
				className={cn(
					"max-w-none overflow-y-auto px-5 py-4 font-sans outline-none sm:px-6 sm:py-5",
					"[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:ps-6 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:ps-6",
					"focus-visible:outline-none",
					variant === "document" ? "min-h-[30rem] text-base" : "min-h-44 text-[15px]",
				)}
				renderAnnotation={renderAnnotation}
				renderDecorator={renderDecorator}
				renderListItem={({ children }) => children}
				renderStyle={renderStyle}
			/>
		</EditorProvider>
	);
}

export function PortableTextEditor({
	value,
	onChange,
	variant = "compact",
	className,
	label,
	required = false,
}: {
	value: PortableTextEditorValue;
	onChange: (value: PortableTextEditorValue) => void;
	variant?: PortableTextEditorVariant;
	className?: string;
	label?: string;
	required?: boolean;
}) {
	const { editor: labels } = useUiMessages();
	const normalized = normalizePortableText(value);
	const labelId = useId();
	const ariaLabel = label ?? "Portable Text";
	const frameLabel = label ? { "aria-labelledby": labelId } : { "aria-label": ariaLabel };
	const surface = (surfaceVariant: PortableTextEditorVariant) => (
		<EditorSurface
			ariaLabel={ariaLabel}
			ariaLabelledBy={label ? labelId : undefined}
			onChange={onChange}
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
							<PortableTextContent value={normalized} variant="article" />
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
