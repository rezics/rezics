"use client";

import { Button, cn } from "@rezics/ui";
import { ArrowBigDownIcon, ArrowBigUpIcon } from "lucide-react";

import { useTranslation } from "@/i18n/client";

export function TagVoteControls({
	canVote,
	isPending,
	onClear,
	onVote,
	score,
	viewerVote,
	voteCount,
}: {
	readonly canVote: boolean;
	readonly isPending: boolean;
	readonly onClear: () => void;
	readonly onVote: (value: -1 | 1) => void;
	readonly score: number;
	readonly viewerVote: -1 | 1 | null;
	readonly voteCount: number;
}) {
	const { t } = useTranslation(["tags"]);
	return (
		<div className="grid gap-2">
			<span className="text-xs text-muted-foreground">
				{t.tags.vote.summary({ score: String(score), count: String(voteCount) })}
			</span>
			{canVote ? (
				<div className="flex flex-wrap items-center gap-1">
					<Button
						aria-pressed={viewerVote === 1}
						className={cn(viewerVote === 1 && "text-primary hover:text-primary")}
						disabled={isPending}
						onClick={() => (viewerVote === 1 ? onClear() : onVote(1))}
						size="sm"
						type="button"
						variant="quiet"
					>
						<ArrowBigUpIcon
							aria-hidden
							fill={viewerVote === 1 ? "currentColor" : "none"}
						/>
						{t.tags.vote.fits}
					</Button>
					<Button
						aria-pressed={viewerVote === -1}
						className={cn(viewerVote === -1 && "text-info hover:text-info")}
						disabled={isPending}
						onClick={() => (viewerVote === -1 ? onClear() : onVote(-1))}
						size="sm"
						type="button"
						variant="quiet"
					>
						<ArrowBigDownIcon
							aria-hidden
							fill={viewerVote === -1 ? "currentColor" : "none"}
						/>
						{t.tags.vote.doesNotFit}
					</Button>
					{viewerVote !== null ? (
						<Button
							disabled={isPending}
							onClick={onClear}
							size="sm"
							type="button"
							variant="quiet"
						>
							{t.tags.vote.clear}
						</Button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
