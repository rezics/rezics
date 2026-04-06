import {useTheme, ClickAwayListener, Fade, Paper, Popper} from '@mui/material';
import EmojiPicker, {Theme, type EmojiClickData} from 'emoji-picker-react';

export interface EmojiPickerOverlayProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPickerOverlay({
  open,
  anchorEl,
  onPick,
  onClose,
}: EmojiPickerOverlayProps) {
  const theme = useTheme();

  return (
    <Popper
      open={open && !!anchorEl}
      anchorEl={anchorEl}
      placement="bottom-start"
      style={{zIndex: 2000}}
      transition
    >
      {({TransitionProps}) => (
        <Fade {...TransitionProps} timeout={160}>
          <div>
            <ClickAwayListener onClickAway={onClose}>
              <Paper elevation={10} sx={{overflow: 'hidden'}}>
                <EmojiPicker
                  theme={
                    theme.palette.mode === 'dark' ? Theme.DARK : Theme.LIGHT
                  }
                  previewConfig={{showPreview: false}}
                  height={380}
                  width={340}
                  onEmojiClick={(emoji: EmojiClickData) => {
                    const native = (emoji?.emoji ?? '').toString();
                    if (!native) return;
                    onPick(native);
                  }}
                />
              </Paper>
            </ClickAwayListener>
          </div>
        </Fade>
      )}
    </Popper>
  );
}
