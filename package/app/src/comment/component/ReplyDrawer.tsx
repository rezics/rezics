import {useDialogStore} from '../state/dialogStore';
import {Drawer} from '@mui/material';
import React from 'react';

import {RezicsMarkdownEditor} from '@rezics/ui/editor';

export type ReplyDrawerShowProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  content: string;
  onContentChange: (content: string) => void;
};

export const ReplyDrawerShow: React.FC<ReplyDrawerShowProps> = ({
  open,
  onClose,
  onSubmit,
  content,
  onContentChange,
}) => {
  return (
    <Drawer open={open} onClose={onClose} anchor="bottom" sx={{zIndex: 2000}}>
      <div
        className="w-11/12 mx-auto my-4 min-h-[250px] h-[480px]
                  grid gap-4
                  grid-cols-1"
      >
        {/* 内容区域 */}
        <div className="flex flex-col">
          <RezicsMarkdownEditor
            value={content}
            onChange={onContentChange}
            onSubmit={onSubmit}
            submitLabel="提交"
          />
        </div>

      </div>
    </Drawer>
  );
};

function extractMentions(text: string): string[] {
  const result: string[] = [];

  // 全局版本，和你原规则语义一致
  const mentionRegex = /(^|[\s([{<])@([^\s@]{1,32})/g;

  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(text)) !== null) {
    result.push(match[2]); // 只要用户名，不要 @ 和前导字符
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
  const entry = useDialogStore(state => state.dialogs[dialogId]);
  const setDialogVisible = useDialogStore(state => state.setDialogVisible);
  const setDialogContent = useDialogStore(state => state.setDialogContent);

  const handleClose = () => {
    setDialogVisible(dialogId, false);
  };

  const handleSubmit = () => {
    if (onSubmit && entry?.contentMain !== undefined) {
      const mentions = extractMentions(entry.contentMain);
      let content: string | {text: string; mentions: string[]};
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
    <ReplyDrawerShow
      open={entry?.visible ?? false}
      onClose={handleClose}
      onSubmit={handleSubmit}
      content={entry?.contentMain ?? ''}
      onContentChange={handleChange}
    />
  );
};
