"use client";

import { ChevronDownIcon, ShieldCheckIcon } from "lucide-react";
import { useId, useState } from "react";
import type { ContentLanguage } from "@rezics/i18n";

import { Button, Card, CardContent } from "@rezics/ui";
import { readPortableText } from "@/lib/block";
import { LocalizedPortableTextContent } from "@/features/content-language-display/localized-portable-text-content";
import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";

export interface RealmRulePresentation {
	readonly id: string;
	readonly language: ContentLanguage;
	readonly title: string;
	readonly content: Parameters<typeof readPortableText>[0];
}

export function RealmRulesCard({
	rules,
	title,
}: {
	readonly rules: readonly RealmRulePresentation[];
	readonly title: string;
}) {
	return (
		<Card appearance="outlined" className="min-w-0 max-w-full overflow-hidden">
			<CardContent className="grid min-w-0 gap-2 overflow-hidden px-5">
				<div className="flex items-center justify-between gap-3">
					<h2 className="font-serif font-semibold text-lg">{title}</h2>
					<ShieldCheckIcon aria-hidden className="size-4 text-brand" />
				</div>
				<div className="min-w-0">
					{rules.map((rule, index) => (
						<RealmRuleDisclosure index={index + 1} key={rule.id} rule={rule} />
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function RealmRuleDisclosure({
	index,
	rule,
}: {
	readonly index: number;
	readonly rule: RealmRulePresentation;
}) {
	const [open, setOpen] = useState(false);
	const contentId = useId();

	return (
		<section className="min-w-0 max-w-full">
			<h3 className="min-w-0">
				<Button
					aria-controls={contentId}
					aria-expanded={open}
					className="h-auto min-w-0 max-w-full whitespace-normal w-full items-start justify-between gap-3 overflow-hidden px-0 py-2.5 text-left font-normal"
					onClick={() => setOpen((current) => !current)}
					type="button"
					variant="quiet"
				>
					<span className="flex min-w-0 flex-1 items-start gap-3">
						<span className="w-5 shrink-0 text-right text-muted-foreground tabular-nums">
							{index}
						</span>
						<span className="min-w-0 flex-1 break-words text-left [overflow-wrap:anywhere]">
							<LocalizedText language={rule.language} value={rule.title} />
						</span>
					</span>
					<ChevronDownIcon
						aria-hidden
						className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${
							open ? "rotate-180" : ""
						}`}
					/>
				</Button>
			</h3>
			{open ? (
				<div className="min-w-0 overflow-hidden ps-8 pb-4" id={contentId}>
					<LocalizedPortableTextContent
						className="min-w-0 break-words [overflow-wrap:anywhere]"
						language={rule.language}
						value={readPortableText(rule.content)}
						variant="compact"
					/>
				</div>
			) : null}
		</section>
	);
}
