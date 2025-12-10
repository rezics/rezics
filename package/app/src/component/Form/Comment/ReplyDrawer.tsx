import {useDialogStore} from '@/global/dialogStore';
import {Button, Drawer} from '@mui/material';
import React from 'react';

import EasyEditor from '../EasyEditor';

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
        className="w-11/12 sm:w-3/4 mx-auto my-4 min-h-[250px] h-[400px]
                  grid gap-4
                  grid-cols-1 sm:grid-cols-[1fr_auto]"
      >
        {/* 内容区域 */}
        <div className="flex flex-col">
          <EasyEditor value={content} onChange={onContentChange} />
        </div>

        {/* 按钮栏：小屏下在底部，大屏右侧对齐 */}
        <div className="flex sm:flex-col gap-2 self-stretch justify-end sm:justify-end">
          <Button
            variant="contained"
            onClick={onSubmit}
            className="w-full sm:w-auto mb-4"
          >
            提交
          </Button>
        </div>
      </div>
    </Drawer>
  );
};

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
      onSubmit(entry.contentMain);
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
