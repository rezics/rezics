import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import React from 'react';
import {useLocation} from 'wouter';
import {Facebook, Twitter, Instagram} from '@mui/icons-material';

export type ReactionBarToolBoxProps = {
  open: boolean;
  onClose: () => void;
  itemUrl?: string;
};

export const ReactionBarToolBox: React.FC<ReactionBarToolBoxProps> = ({
  open,
  onClose,
  itemUrl,
}) => {
  const [_, navigate] = useLocation();

  function handleLinkClick() {
    navigator.clipboard.writeText(itemUrl || '');
    navigate(itemUrl || '');
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          className: 'min-w-[20rem]',
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
            <Facebook />
            <Twitter />
            <Instagram />
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
