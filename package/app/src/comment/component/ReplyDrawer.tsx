import { Drawer } from "@mui/material";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import type React from "react";
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

  return (
    <Drawer
      open={entry?.visible ?? false}
      onClose={handleClose}
      anchor="bottom"
      sx={{ zIndex: 2000 }}
    >
      <div className="w-11/12 mx-auto my-4 flex flex-col min-h-[250px]">
        <div className="flex-1 flex flex-col">
          <RezicsMarkdownEditor
            value={entry?.contentMain ?? ""}
            onChange={handleChange}
            onSubmit={handleSubmit}
            submitLabel="提交"
          />
        </div>
      </div>
    </Drawer>
  );
};
