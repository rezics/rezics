import { Button, Dialog, DialogActions, DialogContent } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { Facebook, Instagram } from "lucide-react";
import { IconBrandTelegram as Telegram, IconBrandTwitter as Twitter } from "@tabler/icons-react";

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
      onClose={onClose}
      slotProps={{
        paper: {
          className: "min-w-[20rem]",
        },
      }}
    >
      {/* <DialogTitle>ReactionBarToolBox</DialogTitle> */}
      <DialogContent>
        <div>
          <Button
            onClick={handleLinkClick}
            variant="outlined"
            className="w-full"
          >
            打开独立页面
          </Button>
        </div>
        <div className="mt-2">
          <div>Share</div>
          <div>{itemUrl}</div>
          <div className="flex items-center gap-2 mt-2">
            <a
              href={`https://t.me/share/url?url=${itemFullUrl}&text=${itemText}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Telegram />
            </a>
            <a
              href={`https://x.com/intent/tweet?url=${itemFullUrl}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Twitter />
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${itemFullUrl}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Facebook />
            </a>
            <a
              href={`https://www.instagram.com/share?url=${itemFullUrl}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram />
            </a>
          </div>
        </div>
        <DialogActions>
          <Button onClick={onClose} variant="text">
            Close
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};
