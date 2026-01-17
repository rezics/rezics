import React from "react";

import { useTheme, ClickAwayListener, Fade, Paper, Popper } from "@mui/material";
import EmojiPicker, { Theme, type EmojiClickData } from "emoji-picker-react";

export interface EmojiMartPickerProps {
  open: boolean;
  onPick: (emoji: string) => void;
  onClose: () => void;
  zIndex?: number;
}

type Placement = "top" | "bottom";

const DEFAULT_PICKER_HEIGHT_PX = 420;

export function EmojiMartPicker({
  open,
  onPick,
  onClose,
  zIndex = 2000,
}: EmojiMartPickerProps) {
  const theme = useTheme();
  const paperRef = React.useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = React.useState<Placement>("top");

  const virtualAnchorEl = document.querySelector(
    '.editor-toolbar .bx-smile'
  ) as HTMLElement | null;

  const anchorPosition = virtualAnchorEl?.getBoundingClientRect();

  const isOpen = open && !!virtualAnchorEl;

  const recomputePlacement = React.useCallback(() => {
    if (!anchorPosition) return;
    const viewportHeight = window.innerHeight || 0;
    const spaceAbove = Math.max(0, anchorPosition.top);
    const spaceBelow = Math.max(0, viewportHeight - anchorPosition.top);
    const pickerHeight =
      paperRef.current?.getBoundingClientRect().height ?? DEFAULT_PICKER_HEIGHT_PX;

    // Prefer top if it fits OR if it's at least as good as below.
    const nextPlacement: Placement =
      spaceAbove >= pickerHeight || spaceAbove >= spaceBelow
        ? "top"
        : "bottom";
    setPlacement(nextPlacement);
  }, [anchorPosition]);

  React.useLayoutEffect(() => {
    if (!isOpen) return;
    // Wait a frame so Popper/Paper have a size to measure.
    const raf = window.requestAnimationFrame(() => {
      recomputePlacement();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isOpen, recomputePlacement]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onResize = () => recomputePlacement();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen, recomputePlacement]);

  return (
    <Popper
      open={isOpen}
      anchorEl={virtualAnchorEl as any}
      placement={placement}
      style={{ zIndex }}
      transition
      modifiers={[
        {
          name: "offset",
          options: {
            offset: placement === "top" ? [0, 8] : [0, -8],
          },
        },
      ]}
    >
      {({ TransitionProps }) => (
        <Fade
          {...TransitionProps}
          timeout={160}
          onEntered={() => recomputePlacement()}
        >
          <div>
            <ClickAwayListener onClickAway={onClose}>
              <Paper ref={paperRef} elevation={10} sx={{ overflow: "hidden" }}>
                <EmojiPicker
                  theme={theme.palette.mode === "dark" ? Theme.DARK : Theme.LIGHT}
                  previewConfig={{ showPreview: false }}
                  height={380}
                  width={340}
                  onEmojiClick={(emoji: EmojiClickData) => {
                    const native = (emoji?.emoji ?? "").toString();
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
