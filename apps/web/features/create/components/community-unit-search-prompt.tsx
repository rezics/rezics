"use client";

import {
	Checkbox,
	Field,
	FieldLabel,
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@rezics/ui";
import { CircleHelp } from "lucide-react";
import { useId } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import {
	communityUnitSearchHref,
	type CommunityUnitSearchSubject,
} from "@/features/create/model/community-unit-search";

/** Requires duplicate-check confirmation while preserving the exact search link. */
export function CommunityUnitSearchPrompt({
	confirmed,
	onConfirmedChange,
	query,
	searchHref,
	subject,
}: {
	readonly confirmed: boolean;
	readonly onConfirmedChange: (confirmed: boolean) => void;
	readonly query: string;
	readonly searchHref?: string;
	readonly subject: CommunityUnitSearchSubject;
}) {
	const { t } = useTranslation("create");
	const messages = t.communityUnitSearch;
	const subjectLabel = messages.subjects[subject.kind];
	const confirmationInputId = useId();
	const confirmationLabelId = useId();

	return (
		<div className="flex items-center gap-2">
			<Field className="w-auto" orientation="horizontal" required>
				<Checkbox
					aria-labelledby={confirmationLabelId}
					checked={confirmed}
					ids={{ hiddenInput: confirmationInputId }}
					name="communityUnitSearchConfirmed"
					onCheckedChange={({ checked }) => onConfirmedChange(checked === true)}
					required
				/>
				<FieldLabel className="font-normal" htmlFor={confirmationInputId} id={confirmationLabelId}>
					{messages.confirmationLabel({ subject: subjectLabel })}
				</FieldLabel>
			</Field>
			<HoverCard closeDelay={160} openDelay={400} positioning={{ placement: "bottom-start" }}>
				<HoverCardTrigger asChild>
					<Link
						className="inline-flex w-fit shrink-0 items-center gap-1 rounded-sm font-semibold text-foreground no-underline outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/32"
						href={searchHref ?? communityUnitSearchHref(subject, query)}
						rel="noopener noreferrer"
						target="_blank"
					>
						{messages.prompt({ subject: subjectLabel })}
						<CircleHelp aria-hidden className="size-4 shrink-0" />
					</Link>
				</HoverCardTrigger>
				<HoverCardContent className="w-[min(24rem,calc(100vw-2rem))]">
					<p className="text-sm leading-6">{messages.policy}</p>
				</HoverCardContent>
			</HoverCard>
		</div>
	);
}
