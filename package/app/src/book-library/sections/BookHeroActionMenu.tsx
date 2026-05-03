import {
  EditOutlined,
  IosShareOutlined,
  MoreHoriz,
} from "@mui/icons-material";
import { IconButton, ListItemIcon, Menu, MenuItem, Tooltip } from "@mui/material";
import { useCanEdit } from "@rezics/api/hooks";
import type { BookDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useShareMenu } from "@/engagement/hooks/useShareMenu";

interface BookHeroActionMenuProps {
  bookInfo: BookDTO;
  shareTitle?: string;
}

export const BookHeroActionMenu: React.FC<BookHeroActionMenuProps> = ({
  bookInfo,
  shareTitle,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canEdit = useCanEdit({ resource: "book", ownerUnit: bookInfo });

  const bookId = bookInfo?.unitId ?? "";
  const shareHref = bookId ? `/book/${bookId}` : "/";
  const share = useShareMenu({ href: shareHref, title: shareTitle });

  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const moreOpen = Boolean(moreAnchor);

  const openMore = (e: React.MouseEvent<HTMLElement>) =>
    setMoreAnchor(e.currentTarget);
  const closeMore = () => setMoreAnchor(null);

  const handleEdit = () => {
    closeMore();
    if (bookId) navigate({ to: "/book/$bookId/edit", params: { bookId } });
  };

  const showMoreButton = canEdit; // only editors see the kebab today

  return (
    <div className="flex items-center gap-1 text-white">
      <Tooltip title={t("common.share", "分享")} placement="bottom">
        <IconButton
          aria-label={t("common.share", "分享")}
          onClick={share.handleOpen}
          size="small"
          sx={{
            color: "inherit",
            "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
          }}
        >
          <IosShareOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={share.anchorEl}
        open={share.open}
        onClose={share.handleClose}
        onClick={(e) => e.stopPropagation()}
      >
        <MenuItem onClick={share.handleCopy}>
          {t("common.copy_link", "複製連結")}
        </MenuItem>
        {share.canWebShare && (
          <MenuItem onClick={share.handleWebShare}>
            {t("common.share_via", "分享…")}
          </MenuItem>
        )}
      </Menu>

      {showMoreButton && (
        <>
          <Tooltip title={t("common.more", "更多")} placement="bottom">
            <IconButton
              aria-label={t("common.more", "更多")}
              onClick={openMore}
              size="small"
              sx={{
                color: "inherit",
                "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
              }}
            >
              <MoreHoriz fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={moreAnchor}
            open={moreOpen}
            onClose={closeMore}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem onClick={handleEdit}>
              <ListItemIcon>
                <EditOutlined fontSize="small" />
              </ListItemIcon>
              {t("book.hero.actions.edit_details", "編輯書籍詳情")}
            </MenuItem>
          </Menu>
        </>
      )}
    </div>
  );
};
