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

export function CatalogShareAction({ unitId }: { readonly unitId: string }) {
	const { data: session } = useHydratedSession();
	const { t } = useTranslation(["engagement", "feed"]);
	const recordShare = usePutApiReactionsSharesByUnitId();
	const [open, setOpen] = useState(false);
	const [nativeShareAvailable, setNativeShareAvailable] = useState(false);
	const [status, setStatus] = useState<ShareStatus>("idle");

	useEffect(() => {
		setNativeShareAvailable("share" in navigator);
	}, []);

	function record() {
		if (session) recordShare.mutate({ path: { unitId } });
	}

	async function shareNative() {
		try {
			await navigator.share({ url: window.location.href });
			record();
			setOpen(false);
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") return;
			setStatus("error");
		}
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			record();
			setStatus("copied");
		} catch {
			setStatus("error");
		}
	}

	return (
		<Dialog
			onOpenChange={({ open: nextOpen }) => {
				setOpen(nextOpen);
				if (nextOpen) setStatus("idle");
			}}
			open={open}
		>
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
					<Button onClick={() => setOpen(false)} variant="secondary">
						{t.engagement.cancel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
