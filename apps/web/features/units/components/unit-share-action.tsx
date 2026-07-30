"use client";

import { usePutApiReactionsSharesByUnitId } from "@rezics/openapi-tanstack-query";
import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@rezics/ui";
import { Check, Link as LinkIcon, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { useHydratedSession } from "@/lib/use-hydrated-session";

type ShareStatus = "idle" | "copied" | "error";

export function UnitShareAction({ unitId }: { readonly unitId: string }) {
	const { t } = useTranslation(["feed"]);
	const [open, setOpen] = useState(false);

	return (
		<>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						aria-label={t.feed.actions.shareTitle}
						onClick={() => setOpen(true)}
						size="icon-md"
						variant="quiet"
					>
						<Share2 aria-hidden />
					</Button>
				</TooltipTrigger>
				<TooltipContent>{t.feed.actions.shareTitle}</TooltipContent>
			</Tooltip>
			<UnitShareDialog onOpenChange={setOpen} open={open} unitId={unitId} />
		</>
	);
}

export function UnitShareDialog({
	href,
	onOpenChange,
	open,
	unitId,
}: {
	readonly href?: string;
	readonly onOpenChange: (open: boolean) => void;
	readonly open: boolean;
	readonly unitId: string;
}) {
	const { data: session } = useHydratedSession();
	const { t } = useTranslation(["engagement", "feed"]);
	const recordShare = usePutApiReactionsSharesByUnitId();
	const [nativeShareAvailable, setNativeShareAvailable] = useState(false);
	const [status, setStatus] = useState<ShareStatus>("idle");

	useEffect(() => {
		setNativeShareAvailable("share" in navigator);
	}, []);
	useEffect(() => {
		if (open) setStatus("idle");
	}, [open]);

	function record() {
		if (session) recordShare.mutate({ path: { unitId } });
	}

	function getShareUrl(): string {
		return href ? new URL(href, window.location.origin).toString() : window.location.href;
	}

	async function shareNative() {
		try {
			await navigator.share({ url: getShareUrl() });
			record();
			onOpenChange(false);
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") return;
			setStatus("error");
		}
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(getShareUrl());
			record();
			setStatus("copied");
		} catch {
			setStatus("error");
		}
	}

	return (
		<Dialog
			onOpenChange={({ open: nextOpen }) => {
				onOpenChange(nextOpen);
				if (nextOpen) setStatus("idle");
			}}
			open={open}
		>
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader
					description={t.feed.actions.shareDescription}
					title={t.feed.actions.shareTitle}
				/>
				<DialogBody className="grid gap-2">
					{nativeShareAvailable ? (
						<Button onClick={() => void shareNative()} variant="outline">
							<Share2 aria-hidden data-icon="inline-start" />
							{t.feed.actions.shareNative}
						</Button>
					) : null}
					<Button onClick={() => void copyLink()} variant="outline">
						{status === "copied" ? (
							<Check aria-hidden data-icon="inline-start" />
						) : (
							<LinkIcon aria-hidden data-icon="inline-start" />
						)}
						{status === "copied" ? t.feed.actions.linkCopied : t.feed.actions.copyLink}
					</Button>
					{status === "error" ? (
						<p className="text-sm text-destructive" role="alert">
							{t.feed.actions.shareFailed}
						</p>
					) : null}
				</DialogBody>
				<DialogFooter className="border-t">
					<Button onClick={() => onOpenChange(false)} variant="secondary">
						{t.engagement.cancel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
