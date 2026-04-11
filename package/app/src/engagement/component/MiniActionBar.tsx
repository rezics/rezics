import { useAlertStore } from "@app/state/windowAlertStore";

import { Comment, Edit, FavoriteBorder, LibraryAdd } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/material";
import {
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from "@rezics/api/reaction/reaction.mutations";
import { reactionQueries } from "@rezics/api/reaction/reaction.queries";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CollectionModal } from "@/collection/component/CollectionModal";
import { FavoriteButton } from "@/collection/component/FavoriteButton";
import { useCollectionModal } from "@/collection/hooks/useCollectionModal";
import { useUserProfileStore } from "@/user/state";

interface MiniAdminActionBarProps {
  editionURL: string;
  textColor?: string;
  userUnitId?: string;
}

export function MiniAdminActionBar({
  editionURL,
  textColor,
  userUnitId,
}: MiniAdminActionBarProps) {
  const { t } = useTranslation();
  const user = useUserProfileStore((state) => state.user);
  const isAdmin = user?.permission?.role.includes("ADMIN");
  const isOwner = user?.unitId === userUnitId;
  const navigate = useNavigate();

  if (!isAdmin && !isOwner) {
    return null;
  }
  return (
    <span>
      <Tooltip title={t("common.edit")} placement="top">
        <IconButton
          aria-label={t("common.edit")}
          size="small"
          onClick={() => {
            navigate({ to: editionURL });
          }}
        >
          <Edit fontSize="small" className={textColor} />
        </IconButton>
      </Tooltip>
    </span>
  );
}

interface MiniActionBarProps {
  hideReply?: boolean;
  className?: string;
  textColor?: string;
  unitId?: string;
  handleOnCommentClick?: () => void;
}

export function MiniActionBar({
  hideReply = false,
  className,
  textColor,
  unitId,
  handleOnCommentClick,
}: MiniActionBarProps) {
  const { t } = useTranslation();
  const { show: showAlert } = useAlertStore();
  const { data } = useQuery(reactionQueries.my(unitId ?? ""));
  const [userReactions, setUserReactions] = useState<string[]>(
    data?.reactionsByTarget?.[unitId ?? ""] ?? [],
  );

  useEffect(() => {
    if (data?.reactionsByTarget?.[unitId ?? ""]) {
      setUserReactions(data?.reactionsByTarget?.[unitId ?? ""]);
    }
  }, [data, unitId]);

  const hasLike = userReactions.includes("like");

  const collection = useCollectionModal(unitId ?? "");

  const createReactionMutation = useCreateReactionMutation({
    onSuccess: () => {
      showAlert("Reaction updated successfully");
    },
  });

  const deleteReactionMutation = useDeleteReactionMutation({
    onSuccess: () => {
      showAlert("Reaction updated successfully");
    },
  });

  const handleToggleReaction = (reaction: "like" | "dislike") => {
    if (!unitId) return;

    const hasReaction = userReactions?.includes(reaction);

    if (hasReaction) {
      deleteReactionMutation.mutate({ targetId: unitId, reaction });
      setUserReactions((prev) => prev.filter((r) => r !== reaction));
    } else {
      createReactionMutation.mutate({ targetId: unitId, reaction });
      setUserReactions((prev) => [...prev, reaction]);
    }
  };

  return (
    <span className={className}>
      <Tooltip title={t("accessibility.favorite")} placement="top">
        <IconButton
          aria-label={t("accessibility.favorite")}
          size="small"
          onClick={() => handleToggleReaction("like")}
        >
          <FavoriteBorder
            fontSize="small"
            color={hasLike ? "primary" : "inherit"}
            className={textColor}
          />
        </IconButton>
      </Tooltip>
      {!hideReply && (
        <Tooltip title={t("accessibility.comments")} placement="top">
          <IconButton
            aria-label={t("accessibility.comments")}
            size="small"
            onClick={handleOnCommentClick ?? undefined}
          >
            <Comment fontSize="small" className={textColor} />
          </IconButton>
        </Tooltip>
      )}
      {unitId && <FavoriteButton unitId={unitId} size="small" color={textColor} />}
      <Tooltip title={t("accessibility.collection")} placement="top">
        <IconButton
          aria-label={t("accessibility.collection")}
          size="small"
          onClick={collection.handleOpen}
        >
          <LibraryAdd fontSize="small" className={textColor} />
        </IconButton>
      </Tooltip>
      {unitId && (
        <CollectionModal
          open={collection.open}
          onClose={collection.handleClose}
          onCollect={collection.handleCollect}
          shelves={collection.shelves}
          status={collection.status}
          userKeywords={collection.userKeywords}
          isCollecting={collection.isCollecting}
          isLoading={collection.isLoading}
        />
      )}
    </span>
  );
}
