import React, { useMemo, useState } from 'react';
import {
  CircularProgress,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  Chip,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  tagByObjectQuery,
  useDetachTagMutation,
  useAttachTagMutation,
  tagApi,
} from '@package/api/tag/tag';
import type { TagDetailDTO, TagDTO } from '@package/api/tag/tag';
import { SingleTagChip } from '../TagList';
import NewTag from './NewTag';
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
  const { data, isLoading, error, refetch } = useQuery(
    tagByObjectQuery(objectUnitId),
  );
  const list: TagDetailDTO[] = useMemo(() => data?.tags ?? [], [data]);

  const [view, setView] = useState<'list' | 'grouped'>('list');
  const [showCreate, setShowCreate] = useState(false);
  const [editingTag, setEditingTag] = useState<TagDetailDTO | null>(null);
  const [search, setSearch] = useState('');
  const [domainList, setDomainList] = useState<any[]>([]);

  const detachMutation = useDetachTagMutation({
    onSuccess: () => refetch(),
  });
  const attachMutation = useAttachTagMutation({
    onSuccess: () => {
      refetch();
    },
  });
  // 新建逻辑放在子组件 TagEdit 中通过回调刷新

  const grouped = useMemo(() => {
    if (view !== 'grouped') return null;
    const m = new Map<string | 'NO_DOMAIN', TagDetailDTO[]>();

    for (const tag of list) {
      const rawDomains: any[] = Array.isArray((tag as any).domains)
        ? ((tag as any).domains as any[])
        : [];

      // 无域：归入 NO_DOMAIN
      if (rawDomains.length === 0) {
        m.set('NO_DOMAIN', [...(m.get('NO_DOMAIN') ?? []), tag]);
        continue;
      }

      // 有域：按域 id 归入，避免使用对象作为 key
      for (const d of rawDomains) {
        const id = d && (d.id ?? d.unitId) ? String(d.id ?? d.unitId) : null;
        if (!id) continue;
        setDomainList(prev => [...prev, { id, title: d.title }]);
        m.set(id, [...(m.get(id) ?? []), tag]);
      }
    }

    return m;
  }, [list, view]);

  const searchTerm = search.trim();
  const {
    data: searchData,
    isLoading: isSearching,
    error: searchError,
  } = useQuery<{
    tags: TagDTO[];
    total: number;
  }>({
    queryKey: ['tags', 'search', searchTerm],
    enabled: searchTerm.length > 0,
    queryFn: () => tagApi.list({ q: searchTerm, limit: 20 }),
  });

  const searchResults: TagDTO[] = useMemo(
    () =>
      (searchData?.tags ?? []).filter(
        t => !list.some(attached => attached.id === t.id),
      ),
    [searchData, list],
  );

  const handleAttach = async (tagId: string) => {
    await attachMutation.mutateAsync({
      unitId: tagId,
      targetUnitId: objectUnitId,
    });
  };

  const onDetach = async (tag: TagDetailDTO) => {
    await detachMutation.mutateAsync({
      unitId: tag.id,
      targetUnitId: objectUnitId,
    });
  };

  const handleEditSaved = async () => {
    setEditingTag(null);
    await refetch();
  };

  const renderListView = () => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-2">
        {list.map(t => (
          <div key={t.id} className="flex items-center justify-between gap-2">
            <SingleTagChip tag={t} />
            <div className="flex items-center gap-2">
              <Button size="small" onClick={() => setEditingTag(t)}>
                编辑
              </Button>
              <Button
                size="small"
                color="error"
                onClick={() => onDetach(t)}
                disabled={detachMutation.isPending}
              >
                解绑
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderGroupedView = () => {
    if (!grouped) return null;
    return (
      <div className="space-y-6 mt-4">
        {[...grouped.entries()].map(([dom, items]) => (
          <div key={dom} className="space-y-2">
            <div className="text-sm font-semibold text-gray-700">
              {dom === 'NO_DOMAIN'
                ? '未分组'
                : domainList.find(d => d.id === dom)?.title ?? dom}
            </div>
            <div className="space-y-1">
              {items.map(t => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2"
                >
                  <SingleTagChip tag={t} />
                  <div className="flex items-center gap-2">
                    {editingTag?.id !== t.id ? (
                      <Button size="small" onClick={() => setEditingTag(t)}>
                        编辑
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setEditingTag(null)}
                      >
                        取消
                      </Button>
                    )}
                    <Button
                      size="small"
                      color="error"
                      onClick={() => onDetach(t)}
                      disabled={detachMutation.isPending}
                    >
                      解绑
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

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
          <NewTag
            objectUnitId={objectUnitId}
            onCreated={async () => {
              setShowCreate(false);
              await refetch();
            }}
            className=""
          />
        </div>
      )}

      {editingTag?.id && (
        <div className="mb-6 p-4 border rounded-md">
          <TagEdit tag={editingTag} onSaved={handleEditSaved} />
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

      {!isLoading && !error && view === 'list' && renderListView()}
      {!isLoading && !error && view === 'grouped' && renderGroupedView()}

      {/* 搜索并添加已有标签 */}
      <div className="mt-6 pt-4 border-t">
        <div className="text-sm font-semibold text-gray-700 mb-2">
          搜索并添加标签
        </div>
        <div className="flex items-center gap-2 mb-3">
          <TextField
            size="small"
            fullWidth
            placeholder="输入标签名搜索…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {isSearching && <CircularProgress size={18} />}
        </div>
        {searchError && (
          <div className="text-xs text-red-600 mb-2">
            搜索失败：{String((searchError as any)?.message ?? searchError)}
          </div>
        )}
        {searchTerm && !isSearching && searchResults.length === 0 && (
          <div className="text-xs text-gray-500">未找到匹配的标签</div>
        )}
        {searchResults.length > 0 && (
          <div className="space-y-1">
            {searchResults.map(t => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2"
              >
                <Chip label={t.name} size="small" />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleAttach(t.id)}
                  disabled={attachMutation.isPending}
                >
                  添加
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagListEdit;
