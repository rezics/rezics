import React, {useEffect, useState} from 'react';
import {
  Checkbox,
  FormControlLabel,
  Typography,
  Button,
  CircularProgress,
  Chip,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {reactionQueries} from '@package/api/reaction/reaction';
import {
  useSetBookmarkTagsMutation,
  useDeleteReactionMutation,
} from '@package/api/reaction/reaction.mutations';
import {useAlertStore} from '@app/state/windowAlertStore';
import {useUserStore} from '@/user/state';
import {Link} from '@package/ui/primitive/link/Link.tsx';

export type BookmarkTagManagerProps = {
  /** 当前内容的 unitId / targetId */
  unitId: string;
  /** 是否显示侧边的 tag 管理面板 */
  open: boolean;
  /** 点击关闭或提交后回调 */
  onClose: () => void;
  key?: string;
  hasBookmarked?: boolean;
};

export const BookmarkTagManager: React.FC<BookmarkTagManagerProps> = ({
  unitId,
  open,
  onClose,
  key,
  hasBookmarked,
}) => {
  const {show: showAlert} = useAlertStore();
  const user = useUserStore(state => state.user);

  const [bookmarked, setBookmarked] = useState(hasBookmarked);
  const {data: myData} = useQuery(reactionQueries.my(unitId));
  useEffect(() => {
    if (myData?.reactionsByTarget?.[unitId ?? '']) {
      setBookmarked(
        myData?.reactionsByTarget?.[unitId ?? '']?.includes('bookmark'),
      );
    }
  }, [myData, unitId]);

  const deleteReactionMutation = useDeleteReactionMutation({
    onSuccess: () => {
      showAlert('收藏已删除');
      onClose();
    },
  });

  const {
    data: userBookmarkTagsData,
    isLoading: _isLoadingUserBookmarkTags,
    isError: _isErrorUserBookmarkTags,
  } = useQuery(reactionQueries.bookmarkTags(user?.unitId ?? ''));

  const {data, isLoading, isError} = useQuery(
    reactionQueries.bookmarkTags(unitId),
  );

  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    if (data?.tags) {
      setSelectedTags(data.tags);
    }
  }, [data]);

  const setBookmarkTagsMutation = useSetBookmarkTagsMutation({
    onSuccess: () => {
      showAlert('书签标签已更新');
      onClose();
    },
  });

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  };

  const handleSubmit = () => {
    if (!unitId) return;
    setBookmarkTagsMutation.mutate({
      targetId: unitId,
      tags: selectedTags,
    });
    // createReactionMutation.mutate({targetId: unitId, reaction: 'bookmark'});
  };

  const handleDeleteBookmark = () => {
    if (!unitId) return;
    deleteReactionMutation.mutate({targetId: unitId, reaction: 'bookmark'});
  };

  if (!open) return null;

  return (
    <div
      className="ml-4 p-3 border rounded shadow-sm bg-white w-64 flex flex-col max-h-72"
      key={key}
    >
      <div>
        <Typography
          variant="subtitle1"
          className="font-semibold mb-1 inline-block"
        >
          标签选择
        </Typography>
        {bookmarked ? (
          <Chip
            label="已经收藏"
            color="primary"
            variant="outlined"
            size="small"
            className="inline-block ml-2"
          />
        ) : (
          <Chip
            label="未收藏"
            color="default"
            size="small"
            className="inline-block ml-2"
          />
        )}
      </div>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <CircularProgress size={24} />
        </div>
      ) : isError ? (
        <div className="flex-1 flex items-center text-sm text-red-500">
          加载标签失败
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto mt-2 space-y-1">
          {userBookmarkTagsData?.tags &&
          userBookmarkTagsData.tags.length > 0 ? (
            userBookmarkTagsData.tags.map(tag => (
              <div key={tag}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedTags.includes(tag)}
                      onChange={() => handleToggleTag(tag)}
                      size="small"
                    />
                  }
                  label={tag}
                />
              </div>
            ))
          ) : (
            <div className="text-xs text-gray-500">
              请前往{' '}
              <Link to="/user/$unitId" params={{unitId: user?.unitId ?? ''}}>
                /user/bookmark
              </Link>{' '}
              页面设置书签标签。
            </div>
          )}
        </div>
      )}

      <div className="pt-2 mt-2 border-t flex justify-end">
        {bookmarked && (
          <Button
            variant="outlined"
            size="small"
            onClick={handleDeleteBookmark}
            disabled={deleteReactionMutation.isPending}
          >
            {deleteReactionMutation.isPending ? '删除中…' : '删除收藏'}
          </Button>
        )}
        <Button
          variant="contained"
          size="small"
          onClick={handleSubmit}
          disabled={setBookmarkTagsMutation.isPending}
          className="!ml-2"
        >
          {setBookmarkTagsMutation.isPending ? '提交中…' : '保存'}
        </Button>
      </div>
    </div>
  );
};
