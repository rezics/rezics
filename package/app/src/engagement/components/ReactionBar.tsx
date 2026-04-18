import { useAlertStore } from "@app/states/windowAlertStore";
import {
  ChatBubbleOutline,
  DeleteOutlined,
  EditOutlined,
  EmojiEvents,
  LibraryAdd,
  OpenInNew,
  SentimentSatisfiedAlt,
} from "@mui/icons-material";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import { IconButton, Tooltip } from "@mui/material";
import {
  useCreateReactionMutation,
  useDeleteReactionMutation,
} from "@rezics/api/reaction/reaction.mutations";
import type React from "react";
import { useEffect, useState } from "react";
import { CollectionModal } from "@/collection/components/CollectionModal";
import { FavoriteButton } from "@/collection/components/FavoriteButton";
import { useCollectionModal } from "@/collection/hooks/useCollectionModal";
import { ReactionBarToolBox } from "./reactionBarToolBox";

async function copyCurrentUrl(url?: string) {
  const theUrl = url || window.location.href;
  try {
    await navigator.clipboard.writeText(theUrl);
    console.log("URL copied to clipboard");
  } catch (err) {
    console.error("Copy failed:", err);
  }
}

export type ReactionAdminBarProps = {
  className?: string;
  size?: "small" | "medium" | "large";
  fontSize?: string;
  onEdit: () => void;
  onDelete: () => void;
};

export function ReactionAdminBar({
  className,
  size = "large",
  fontSize = "1.5rem",
  onEdit,
  onDelete,
}: ReactionAdminBarProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <IconButton
        size={size}
        sx={{ fontSize }}
        onClick={onEdit}
        className="ml-2"
      >
        <EditOutlined fontSize="inherit" />
      </IconButton>

      <IconButton
        size={size}
        sx={{ fontSize }}
        onClick={onDelete}
        className="ml-2"
      >
        <DeleteOutlined fontSize="inherit" />
      </IconButton>
    </div>
  );
}

export type ReactionBarProps = {
  onReply?: () => void;
  unitId?: string;
  className?: string;
  size?: "small" | "medium" | "large";
  fontSize?: string;
  itemUrl?: string;
  hideLike?: boolean;
  hideDislike?: boolean;
  hideReply?: boolean;
  hideBookmark?: boolean;
  hideShare?: boolean;
  currentUserReactions?: string[];
};

export const ReactionBar: React.FC<ReactionBarProps> = ({
  onReply,
  unitId,
  className,
  size = "large",
  fontSize = "1.5rem",
  itemUrl,
  hideLike = false,
  hideDislike = false,
  hideReply = false,
  hideBookmark = false,
  hideShare = false,
  currentUserReactions,
}) => {
  const handleReply = () => {
    onReply?.();
  };

  const [isToolBoxOpen, setIsToolBoxOpen] = useState(false);
  const { show: showAlert } = useAlertStore();

  const collection = useCollectionModal(unitId ?? "");

  const [userReactions, setUserReactions] = useState<string[]>(
    currentUserReactions ?? [],
  );

  useEffect(() => {
    setUserReactions(currentUserReactions ?? []);
  }, [currentUserReactions]);

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

  const hasLike = userReactions.includes("like");
  const hasDislike = userReactions.includes("dislike");

  const handleToggleReaction = (reaction: "like" | "dislike") => {
    if (!unitId) return;

    const hasReaction = userReactions.includes(reaction);

    if (hasReaction) {
      deleteReactionMutation.mutate({ targetId: unitId, reaction });
      setUserReactions((prev) => prev.filter((r) => r !== reaction));
    } else {
      createReactionMutation.mutate({ targetId: unitId, reaction });
      setUserReactions((prev) => [...prev, reaction]);
    }
  };

  return (
    <div className={`flex items-start w-full max-w-2xl mx-auto ${className}`}>
      <div className="flex justify-between items-center flex-1">
        {!hideLike && (
          <div>
            <IconButton
              size={size}
              sx={{ fontSize }}
              onClick={() => handleToggleReaction("like")}
            >
              <ThumbUpAltOutlinedIcon
                fontSize="inherit"
                color={hasLike ? "primary" : "inherit"}
              />
            </IconButton>
          </div>
        )}
        {!hideDislike && (
          <div>
            <IconButton
              size={size}
              sx={{ fontSize }}
              onClick={() => handleToggleReaction("dislike")}
            >
              <ThumbDownAltOutlinedIcon
                fontSize="inherit"
                color={hasDislike ? "error" : "inherit"}
              />
            </IconButton>
          </div>
        )}

        {!hideReply && (
          <div>
            <IconButton size={size} sx={{ fontSize }} onClick={handleReply}>
              <ChatBubbleOutline fontSize="inherit" />
            </IconButton>
          </div>
        )}

        {!hideBookmark && unitId && (
          <>
            <FavoriteButton unitId={unitId} size={size} />
            <div>
              <Tooltip title="Collect">
                <IconButton
                  size={size}
                  sx={{ fontSize }}
                  onClick={collection.handleOpen}
                >
                  <LibraryAdd fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </div>
            <CollectionModal
              open={collection.open}
              onClose={collection.handleClose}
              onCollect={collection.handleCollect}
              shelves={collection.shelves}
              status={collection.status}
              isCollecting={collection.isCollecting}
              isLoading={collection.isLoading}
            />
          </>
        )}

        {!hideShare && (
          <div>
            <IconButton
              size={size}
              sx={{ fontSize }}
              onClick={() => {
                showAlert("Link copied to clipboard");
                const origin = window?.location?.origin;
                const theUrl = origin + itemUrl;
                copyCurrentUrl(theUrl);
                setIsToolBoxOpen(true);
              }}
            >
              <OpenInNew fontSize="inherit" />
            </IconButton>
          </div>
        )}
        <ReactionBarToolBox
          open={isToolBoxOpen}
          onClose={() => {
            setIsToolBoxOpen(false);
          }}
          itemUrl={itemUrl}
        />
      </div>
    </div>
  );
};

export function AwardReactionBar() {
  return (
    <div>
      <Tooltip title="Funny">
        <IconButton size="medium">
          <SentimentSatisfiedAlt style={{ fontSize: "1rem" }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Award">
        <IconButton size="medium">
          <EmojiEvents style={{ fontSize: "1rem" }} />
        </IconButton>
      </Tooltip>
    </div>
  );
}
