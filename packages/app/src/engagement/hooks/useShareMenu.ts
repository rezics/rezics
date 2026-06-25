import { useCurrentUserId } from "@rezics/contract/api/hooks/useCurrentUserId";
import { useCreatePostMutation } from "@rezics/contract/api/post/post";
import { useRecordShareMutation } from "@rezics/contract/api/reaction/reaction.mutations";
import { useTranslation } from "@rezics/i18n/react";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthoringLanguageDefault } from "../../shared/hooks/useAuthoringLanguageDefault";
import { useAuthGuard } from "../../user/hooks/useAuthGuard";

export { shouldRecordShareIntent } from "../models/shareIntent";

import { shouldRecordShareIntent } from "../models/shareIntent";
import { buildInternalSharePostCreateInput } from "../models/sharePost";

export type UseShareMenuArgs = {
  href: string;
  title?: string;
  targetId?: string;
};

export type UseShareMenuReturn = {
  anchorEl: HTMLElement | null;
  open: boolean;
  canWebShare: boolean;
  handleOpen: (event: React.MouseEvent<HTMLElement>) => void;
  handleClose: (event?: React.MouseEvent | object) => void;
  handleCopy: (event: React.MouseEvent) => Promise<void>;
  handleWebShare: (event: React.MouseEvent) => Promise<void>;
  handleDirectShare: (event: React.MouseEvent) => void;
  handleWriteShare: (event: React.MouseEvent) => void;
  canInternalShare: boolean;
  isInternalSharePending: boolean;
  authModal: React.ReactNode;
};

function absolute(href: string): string {
  if (/^https?:\/\//.test(href)) return href;
  if (typeof window === "undefined") return href;
  return window.location.origin + href;
}

export function useShareMenu({
  href,
  title,
  targetId,
}: UseShareMenuArgs): UseShareMenuReturn {
  const { t } = useTranslation(["common"]);
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const actorUserId = useCurrentUserId();
  const language = useAuthoringLanguageDefault();
  const authGuard = useAuthGuard();
  const shareMutation = useRecordShareMutation();
  const createPostMutation = useCreatePostMutation();

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (
      targetId &&
      shouldRecordShareIntent({
        actorUserId,
        targetId,
        isPending: shareMutation.isPending,
      })
    ) {
      shareMutation.mutate({ targetId });
    }
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (event?: React.MouseEvent | object) => {
    if (event && "stopPropagation" in event) {
      (event as React.MouseEvent).stopPropagation();
    }
    setAnchorEl(null);
  };

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(absolute(href));
      toast.success(t("common:link_copied"));
    } catch {
      // swallow — clipboard write can fail in insecure contexts
      // 吞掉错误 —— 在不安全上下文中剪贴板写入可能失败
    }
    setAnchorEl(null);
  };

  const canWebShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: unknown }).share === "function";

  const handleWebShare = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await (navigator as Navigator).share({
        url: absolute(href),
        title,
      });
    } catch {
      // user-cancelled or unsupported; nothing to do
      // 用户取消或不支持；无需处理
    }
    setAnchorEl(null);
  };

  const handleDirectShare = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!targetId || !authGuard.requireAuth()) return;
    createPostMutation.mutate(
      buildInternalSharePostCreateInput({
        targetUnitId: targetId,
        title: title || t("common:share_post_default_title"),
        language,
      }),
      {
        onSuccess: (post) => {
          toast.success(t("common:share_post_created"));
          setAnchorEl(null);
          navigate({
            to: "/post/$rootPostUnitId",
            params: { rootPostUnitId: post.unitId },
          });
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  const handleWriteShare = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!targetId || !authGuard.requireAuth()) return;
    setAnchorEl(null);
    navigate({
      to: "/create",
      search: {
        shareTargetId: targetId,
        shareTitle: title,
      },
    });
  };

  return {
    anchorEl,
    open: Boolean(anchorEl),
    canWebShare,
    handleOpen,
    handleClose,
    handleCopy,
    handleWebShare,
    handleDirectShare,
    handleWriteShare,
    canInternalShare: Boolean(targetId),
    isInternalSharePending: createPostMutation.isPending,
    authModal: authGuard.AuthModal({}),
  };
}
