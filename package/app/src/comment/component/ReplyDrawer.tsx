import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import type React from "react";
import { useEffect, useRef } from "react";
import { useDialogStore } from "../state/dialogStore";

function extractMentions(text: string): string[] {
  const result: string[] = [];

  // 全局版本，和你原规则语义一致
  const mentionRegex = /(^|[\s([{<])@([^\s@]{1,32})/g;

  let match: RegExpExecArray | null = mentionRegex.exec(text);
  while (match !== null) {
    result.push(match[2]); // 只要用户名，不要 @ 和前导字符
    match = mentionRegex.exec(text);
  }

  return result;
}

export type ReplyDrawerContainerProps = {
  dialogId: string;
  onSubmit?: (content: string) => void;
};

export const ReplyDrawerContainer: React.FC<ReplyDrawerContainerProps> = ({
  dialogId,
  onSubmit,
}) => {
  const entry = useDialogStore((state) => state.dialogs[dialogId]);
  const setDialogVisible = useDialogStore((state) => state.setDialogVisible);
  const setDialogContent = useDialogStore((state) => state.setDialogContent);
  const panelRef = useRef<HTMLDivElement>(null);

  const isOpen = entry?.visible ?? false;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDialogVisible(dialogId, false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, dialogId, setDialogVisible]);

  const handleClose = () => {
    setDialogVisible(dialogId, false);
  };

  const handleSubmit = () => {
    if (onSubmit && entry?.contentMain !== undefined) {
      const mentions = extractMentions(entry.contentMain);
      let content: string | { text: string; mentions: string[] };
      if (mentions.length > 0) {
        content = {
          text: entry.contentMain,
          mentions,
        };
        content = JSON.stringify(content);
      } else {
        content = entry.contentMain;
      }
      onSubmit(content);
      handleClose();
    }
  };

  const handleChange = (value: string) => {
    setDialogContent(dialogId, value);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        isOpen
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      }`}
      onClick={handleOverlayClick}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`absolute bottom-0 left-1/2 w-full max-w-4xl -translate-x-1/2 transition-transform duration-200 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* TODO need fix background color and rounded corner for top(it could be larger because person can't see the top of the drawer) */}
        <div className="bg-white">
          <RezicsMarkdownEditor
            value={entry?.contentMain ?? ""}
            onChange={handleChange}
            onSubmit={handleSubmit}
            submitLabel="提交"
          />
        </div>
      </div>
    </div>
  );
};
