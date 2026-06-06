import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const { resolvedTheme } = useTheme();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!open || !anchorEl) {
      setPosition(null);
      return;
    }
    const rect = anchorEl.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left });
  }, [open, anchorEl]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (overlayRef.current?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, anchorEl, onClose]);

  if (!open || !anchorEl || !position) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed z-[2000] rounded-md shadow-lg overflow-hidden bg-rezics-surface-elevated"
      style={{ top: position.top, left: position.left }}
    >
      <EmojiPicker
        theme={resolvedTheme === "dark" ? Theme.DARK : Theme.LIGHT}
        previewConfig={{ showPreview: false }}
        height={380}
        width={340}
        onEmojiClick={(emoji: EmojiClickData) => {
          const native = (emoji?.emoji ?? "").toString();
          if (!native) return;
          onPick(native);
        }}
      />
    </div>,
    document.body,
  );
}
