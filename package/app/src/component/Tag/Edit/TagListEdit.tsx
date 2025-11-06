import React, {useMemo, useState} from 'react';
import {
  CircularProgress,
  Chip,
  Button,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {
  tagByObjectQuery,
  useAttachTagMutation,
  useDetachTagMutation,
} from '@/api/tag/tag';
import type {TagDetailDTO} from '@/api/tag/tag';
import TagList from '../TagList';
import TagEdit from './TagEdit';

export type TagListEditProps = {
  objectUnitId: string; // 目标对象 unitId
  className?: string;
};

/**
 * TagListEdit – 针对某个对象（如 book）的标签管理
 * - 支持纯列表与按 domain 分组视图
 * - 支持创建新标签并自动 attach
 */
export const TagListEdit: React.FC<TagListEditProps> = ({
  objectUnitId,
  className,
}) => {
  const {data, isLoading, error, refetch} = useQuery(
    tagByObjectQuery(objectUnitId),
  );
  const list: TagDetailDTO[] = useMemo(() => data?.tags ?? [], [data]);

  const [view, setView] = useState<'list' | 'grouped'>('list');
  const [showCreate, setShowCreate] = useState(false);

  const attachMutation = useAttachTagMutation({
    onSuccess: () => refetch(),
  });
  const detachMutation = useDetachTagMutation({
    onSuccess: () => refetch(),
  });
  // 新建逻辑放在子组件 TagEdit 中通过回调刷新

  const grouped = useMemo(() => {
    if (view !== 'grouped') return null;
    const m = new Map<string | 'NO_DOMAIN', TagDetailDTO[]>();
    for (const tag of list) {
      const doms = tag.domains?.length ? tag.domains : ['NO_DOMAIN'];
      for (const d of doms) {
        m.set(d, [...(m.get(d) ?? []), tag]);
      }
    }
    return m;
  }, [list, view]);

  const onDetach = async (tag: TagDetailDTO) => {
    await detachMutation.mutateAsync({
      unitId: tag.id,
      targetUnitId: objectUnitId,
    });
  };

  // create handled inline inside TagEdit via createMutation

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, v) => v && setView(v)}
        >
          <ToggleButton value="list">列表</ToggleButton>
          <ToggleButton value="grouped">分组</ToggleButton>
        </ToggleButtonGroup>
        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant={showCreate ? 'outlined' : 'contained'}
            onClick={() => setShowCreate(v => !v)}
          >
            {showCreate ? '取消' : '新建标签'}
          </Button>
        </div>
      </div>

      {showCreate && (
        <div className="mb-6 p-4 border rounded-md">
          <TagEdit
            onSaved={async t => {
              await attachMutation.mutateAsync({
                unitId: t.id,
                targetUnitId: objectUnitId,
              });
              setShowCreate(false);
              refetch();
            }}
            className=""
          />
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <CircularProgress size={16} /> 加载中…
        </div>
      )}
      {error && (
        <div className="text-sm text-red-600">
          错误：{String((error as any)?.message ?? error)}
        </div>
      )}

      {!isLoading && !error && list.length === 0 && (
        <div className="text-sm text-gray-500">暂无标签</div>
      )}

      {!isLoading && !error && view === 'list' && list.length > 0 && (
        <div className="space-y-2">
          {list.map(t => (
            <div key={t.id} className="flex items-center justify-between">
              <Chip label={t.name} size="small" />
              <Button
                size="small"
                color="error"
                onClick={() => onDetach(t)}
                disabled={detachMutation.isPending}
              >
                解绑
              </Button>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && view === 'grouped' && grouped && (
        <div className="space-y-6 mt-4">
          {[...grouped.entries()].map(([dom, items]) => (
            <div key={dom} className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">
                {dom === 'NO_DOMAIN' ? '未分组' : dom}
              </div>
              <TagList tags={items} />
              <div className="space-y-1">
                {items.map(t => (
                  <div key={t.id} className="flex items-center justify-between">
                    <Chip label={t.name} size="small" />
                    <Button
                      size="small"
                      color="error"
                      onClick={() => onDetach(t)}
                      disabled={detachMutation.isPending}
                    >
                      解绑
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagListEdit;
