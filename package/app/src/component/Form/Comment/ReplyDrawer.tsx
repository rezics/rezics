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
      {/* 选择下方div的父元素，可以调整背景为透明 */}
      <div className="w-3/4 mx-auto flex gap-4 mt-4 min-h-[250px] h-[400px]">
        {/* 左边编辑器，占大部分宽度 */}
        <div className="flex-1">
          <EasyEditor value={content} onChange={onContentChange} />
        </div>

        {/* 右边按钮区域，竖排，从下往上 */}
        {/* 此时 h-full 都不再是必须的，因为 items-stretch (flex默认值) 会自动拉伸此div */}
        <div className="flex flex-col justify-end space-y-2">
          <Button variant="contained" onClick={onSubmit} className="!mb-2">
            提交
          </Button>
          {/* 更多按钮可以继续加 */}
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
