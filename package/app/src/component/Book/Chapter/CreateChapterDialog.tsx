import {useEffect, useMemo, useState} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

import EasyEditor from '@/component/Form/EasyEditor.tsx';
import {useCreateUnitMutation} from '@/api/unit/unit.mutations';
import {useUserStore} from '@/global/userStore';
import {useAlertStore} from '@/global/windowAlertStore';
import {UnitType} from '@package/contract';
import {type Chapter} from './ChapterArborist';

interface CreateChapterDialogProps {
  open: boolean;
  onClose: () => void;
  bookUnitId: string;
  currentEditParentId: string | number | null;
  handleCreate: ({
    parentId,
    newNode,
  }: {
    parentId: string | number;
    newNode: Chapter;
  }) => void;
}

export function CreateChapterDialog({
  open,
  onClose,
  handleCreate,
  bookUnitId,
  currentEditParentId,
}: CreateChapterDialogProps) {
  const {user} = useUserStore();
  const {show} = useAlertStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // Reset form when dialog is opened
  useEffect(() => {
    if (open) {
      setTitle('');
      setContent('');
    }
  }, [open]);

  const createMutation = useCreateUnitMutation({
    onError: error => {
      show(
        `创建章节失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    },
  });

  const isInvalid = useMemo(
    () => !title.trim() || !content.trim(),
    [title, content],
  );

  async function handleSubmit() {
    if (!open) return;
    if (isInvalid) {
      show('标题和内容不能为空');
      return;
    }

    const userId = (user as any)?.unitId as string | undefined;
    if (!userId) {
      show('请先登录');
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        userId,
        type: UnitType.CHAPTER,
        title,
        content,
        metadata: {},
        targetUnitId: bookUnitId,
      } as any);

      const newNode: Chapter = {
        id: (result as any).id,
        title,
      };

      handleCreate({
        parentId: (currentEditParentId ?? '') as string | number,
        newNode,
      });

      onClose();
    } catch (e) {
      // Error already surfaced via onError
      console.error('Create chapter failed', e);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Create Chapter</DialogTitle>
      <DialogContent dividers>
        <div className="space-y-4">
          <TextField
            label="章节标题"
            fullWidth
            variant="filled"
            value={title}
            onChange={e => setTitle(e.target.value)}
            error={!title.trim()}
            helperText={!title.trim() ? '必填' : ' '}
          />
          <div className="min-h-[300px]">
            <EasyEditor value={content} onChange={setContent} />
            {!content.trim() && (
              <div className="text-sm text-red-600 mt-2">内容为必填</div>
            )}
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={createMutation.isPending}>
          取消
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={isInvalid || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <span className="flex items-center gap-2">
              <CircularProgress size={16} /> 创建中...
            </span>
          ) : (
            '创建'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
