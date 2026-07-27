"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "../utils";

interface ThreadBranchBaseProps {
	className?: string;
	content: ReactNode;
	header: ReactNode;
	marker: ReactNode;
}

interface ThreadBranchLeafProps extends ThreadBranchBaseProps {
	collapseDescendantsLabel?: never;
	descendants?: never;
	descendantsVisible?: never;
	expandDescendantsLabel?: never;
	hasDescendants?: false;
	onDescendantsVisibleChange?: never;
}

interface ThreadBranchParentProps extends ThreadBranchBaseProps {
	collapseDescendantsLabel: string;
	descendants: ReactNode;
	descendantsVisible: boolean;
	expandDescendantsLabel: string;
	hasDescendants: true;
	onDescendantsVisibleChange: (visible: boolean) => void;
}

/**
 * The visual and interaction contract for one item in a threaded discussion.
 *
 * @remarks
 * The component owns the 24 px marker column, descendant indentation, and
 * descendant-only disclosure behavior. The product feature remains responsible
 * for the item's semantic container, marker, header, body, and descendants.
 *
 * @alpha
 */
export type ThreadBranchProps = ThreadBranchLeafProps | ThreadBranchParentProps;

/**
 * Renders a discussion branch without hiding the current item when its
 * descendants are collapsed.
 *
 * @alpha
 */
export function ThreadBranch(props: ThreadBranchProps) {
	const { className, content, header, marker } = props;
	const parentBranch = props.hasDescendants ? props : null;
	const descendantsVisible = parentBranch?.descendantsVisible ?? false;
	const hasDescendants = parentBranch !== null;
	const descendantsId = useId();

	return (
		<div
			className={cn("grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)]", className)}
			data-descendants={hasDescendants ? (descendantsVisible ? "visible" : "hidden") : "none"}
			data-slot="thread-branch"
		>
			<div
				className="col-start-1 row-start-1 flex size-6 items-center justify-center"
				data-slot="thread-branch-marker"
			>
				{marker}
			</div>
			<div className="col-start-2 row-start-1 min-w-0 ps-2" data-slot="thread-branch-header">
				{header}
			</div>
			{parentBranch ? (
				<button
					aria-controls={descendantsId}
					aria-expanded={descendantsVisible}
					aria-label={
						descendantsVisible
							? parentBranch.collapseDescendantsLabel
							: parentBranch.expandDescendantsLabel
					}
					className="group col-start-1 row-start-2 flex h-12 w-6 cursor-pointer flex-col items-center outline-none"
					data-slot="thread-branch-toggle"
					onClick={() => parentBranch.onDescendantsVisibleChange(!descendantsVisible)}
					type="button"
				>
					<span
						aria-hidden
						className="h-8 w-px shrink-0 bg-foreground/30 transition-colors group-hover:bg-foreground/55 group-focus-visible:bg-ring"
						data-slot="thread-branch-toggle-line"
					/>
					<span
						aria-hidden
						className="flex size-4 shrink-0 items-center justify-center rounded-full border border-foreground/35 bg-background text-foreground transition-colors group-hover:border-foreground/60 group-focus-visible:border-ring group-focus-visible:ring-[3px] group-focus-visible:ring-ring/32"
						data-slot="thread-branch-toggle-icon"
					>
						{descendantsVisible ? (
							<MinusIcon className="size-2.5" />
						) : (
							<PlusIcon className="size-2.5" />
						)}
					</span>
				</button>
			) : null}
			<div className="col-start-2 row-start-2 min-w-0 ps-2" data-slot="thread-branch-content">
				{content}
			</div>
			{parentBranch ? (
				<div
					className="col-start-2 row-start-3 min-w-0"
					data-slot="thread-branch-descendants"
					hidden={!descendantsVisible}
					id={descendantsId}
				>
					{parentBranch.descendants}
				</div>
			) : null}
		</div>
	);
}
