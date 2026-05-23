import { Button, Dialog, DialogContent, DialogFooter } from "@rezics/ui/shadcn";
import {
  FacebookIcon,
  InstagramIcon,
  TelegramIcon,
  XIcon,
} from "@rezics/icons";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import * as m from "@rezics/i18n/messages";

export type ReactionBarToolBoxProps = {
  open: boolean;
  onClose: () => void;
  itemUrl?: string;
  itemText?: string;
};

export const ReactionBarToolBox: React.FC<ReactionBarToolBoxProps> = ({
  open,
  onClose,
  itemUrl,
  itemText = "Source: REZICS",
}) => {
  const navigate = useNavigate();
  const origin = window?.location?.origin;
  const itemFullUrl = origin + itemUrl;

  function handleLinkClick() {
    navigator.clipboard.writeText(itemUrl || "");
    if (itemUrl) {
      navigate({ to: itemUrl });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="min-w-[20rem]">
        <div>
          <Button
            onClick={handleLinkClick}
            variant="outline"
            className="w-full"
          >
            {m.engagement_open_standalone_page()}
          </Button>
        </div>
        <div className="mt-2">
          <div>{m.common_share()}</div>
          <div>{itemUrl}</div>
          <div className="flex items-center gap-2 mt-2">
            <a
              href={`https://t.me/share/url?url=${itemFullUrl}&text=${itemText}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <TelegramIcon />
            </a>
            <a
              href={`https://x.com/intent/tweet?url=${itemFullUrl}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <XIcon />
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${itemFullUrl}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FacebookIcon />
            </a>
            <a
              href={`https://www.instagram.com/share?url=${itemFullUrl}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <InstagramIcon />
            </a>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
