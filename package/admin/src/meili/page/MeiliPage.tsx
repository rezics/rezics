import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {
  meiliAdminMutations,
  meiliAdminQueries,
  type MeiliKey,
} from '@package/api/meili/meili.admin.queries';

type MessageState = {
  type: 'success' | 'error' | 'info';
  text: string;
} | null;

/**
 * Meili 管理页面
 */
export function MeiliPage() {
  const [message, setMessage] = useState<MessageState>(null);
  const [lastSearchKey, setLastSearchKey] = useState<string | null>(null);
  const [lastAdminKey, setLastAdminKey] = useState<string | null>(null);

  const {data: health, isLoading: isHealthLoading} = useQuery(
    meiliAdminQueries.health(),
  );

  const {
    data: keyList,
    isLoading: isKeysLoading,
    refetch: refetchKeys,
  } = useQuery(meiliAdminQueries.keys());

  const initBooksMutation = meiliAdminMutations.useInitBooksIndex({
    onSuccess: res => {
      setMessage({
        type: 'success',
        text: res.message || 'Books 索引初始化完成',
      });
    },
    onError: err => {
      setMessage({type: 'error', text: err.message});
    },
  });

  const initReadlistsMutation = meiliAdminMutations.useInitReadlistsIndex({
    onSuccess: res => {
      setMessage({
        type: 'success',
        text: res.message || 'Readlists 索引初始化完成',
      });
    },
    onError: err => setMessage({type: 'error', text: err.message}),
  });

  const initUnitsMutation = meiliAdminMutations.useInitUnitsIndex({
    onSuccess: res => {
      setMessage({
        type: 'success',
        text: res.message || 'Units 索引初始化完成',
      });
    },
    onError: err => setMessage({type: 'error', text: err.message}),
  });

  const initUsersMutation = meiliAdminMutations.useInitUsersIndex({
    onSuccess: res => {
      setMessage({
        type: 'success',
        text: res.message || 'Users 索引初始化完成',
      });
    },
    onError: err => setMessage({type: 'error', text: err.message}),
  });

  const syncBooksMutation = meiliAdminMutations.useSyncBooks({
    onSuccess: () => {
      setMessage({type: 'success', text: '开始同步全部 Books 到 Meili'});
    },
    onError: err => setMessage({type: 'error', text: err.message}),
  });

  const syncReadlistsMutation = meiliAdminMutations.useSyncReadlists({
    onSuccess: () => {
      setMessage({type: 'success', text: '开始同步全部 Readlists 到 Meili'});
    },
    onError: err => setMessage({type: 'error', text: err.message}),
  });

  const syncUnitsMutation = meiliAdminMutations.useSyncUnits({
    onSuccess: () => {
      setMessage({type: 'success', text: '开始同步全部 Units 到 Meili'});
    },
    onError: err => setMessage({type: 'error', text: err.message}),
  });

  const initFeedbacksMutation = meiliAdminMutations.useInitFeedbacksIndex({
    onSuccess: res => {
      setMessage({
        type: 'success',
        text: res.message || 'Feedbacks 索引初始化完成',
      });
    },
    onError: err => setMessage({type: 'error', text: err.message}),
  });

  const syncFeedbacksMutation = meiliAdminMutations.useSyncFeedbacks({
    onSuccess: () => {
      setMessage({
        type: 'success',
        text: '开始同步全部 Feedbacks 到 Meili',
      });
    },
    onError: err => setMessage({type: 'error', text: err.message}),
  });
  const syncUsersMutation = meiliAdminMutations.useSyncUsers({
    onSuccess: () => {
      setMessage({type: 'success', text: '开始同步全部 Users 到 Meili'});
    },
    onError: err => setMessage({type: 'error', text: err.message}),
  });

  const deleteAllUnitsMutation = meiliAdminMutations.useDeleteAllUnits({
    onSuccess: res => {
      setMessage({
        type: 'success',
        text: res.message || '已删除 Meili 中全部 Units',
      });
    },
    onError: err => setMessage({type: 'error', text: err.message}),
  });

  const createSearchKeyMutation = meiliAdminMutations.useCreateSearchKey({
    onSuccess: res => {
      setLastSearchKey(res.key);
      setMessage({type: 'success', text: 'Search Key 已创建'});
    },
    onError: err => setMessage({type: 'error', text: err.message}),
  });

  const createAdminKeyMutation = meiliAdminMutations.useCreateAdminKey({
    onSuccess: res => {
      const keyString =
        typeof (res as any).key === 'string' ? (res as any).key : null;
      setLastAdminKey(keyString);
      setMessage({
        type: 'success',
        text: keyString
          ? 'Admin Key 已创建'
          : 'Admin Key 已创建（查看控制台返回值）',
      });
      if (!keyString) {
        console.log('Meili admin key response', res);
      }
    },
    onError: err => setMessage({type: 'error', text: err.message}),
  });

  const deleteKeyMutation = meiliAdminMutations.useDeleteKey({
    onSuccess: async res => {
      setMessage({
        type: 'success',
        text: res.message || 'Key 已删除',
      });
      await refetchKeys();
    },
    onError: err => setMessage({type: 'error', text: err.message}),
  });

  const handleDeleteKey = (key: MeiliKey) => {
    if (!key.uid) return;
    const ok = window.confirm(
      `确定要删除 Key: ${key.uid}${
        key.name ? ` (${key.name})` : ''
      } ？此操作不可恢复。`,
    );
    if (!ok) return;
    deleteKeyMutation.mutate(key.uid);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="space-y-2">
          <Typography variant="h4" component="h1">
            Meili 管理面板
          </Typography>
          <Typography
            variant="body2"
            className="text-slate-600 dark:text-slate-300"
          >
            仅限 Root 用户使用，用于初始化索引、全量同步数据以及管理 Meilisearch
            API Key。
          </Typography>
          {isHealthLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <CircularProgress size={18} />
              <span>正在检查 Meili 服务状态...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span>Meili 状态：</span>
              <Chip
                label={health?.status ?? 'unknown'}
                color={health?.status === 'available' ? 'success' : 'warning'}
                size="small"
              />
            </div>
          )}
        </div>

        {message && (
          <Alert
            severity={message.type}
            onClose={() => setMessage(null)}
            className="shadow-sm"
          >
            {message.text}
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 索引初始化 */}
          <Card className="shadow-sm">
            <CardHeader
              title="索引初始化"
              subheader="仅在创建索引或调整索引设置后需要执行，一般是一次性操作。"
            />
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => initBooksMutation.mutate()}
                  disabled={initBooksMutation.isPending}
                >
                  {initBooksMutation.isPending
                    ? '初始化中…'
                    : '初始化 Books 索引'}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => initReadlistsMutation.mutate()}
                  disabled={initReadlistsMutation.isPending}
                >
                  {initReadlistsMutation.isPending
                    ? '初始化中…'
                    : '初始化 Readlists 索引'}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => initUnitsMutation.mutate()}
                  disabled={initUnitsMutation.isPending}
                >
                  {initUnitsMutation.isPending
                    ? '初始化中…'
                    : '初始化 Units 索引'}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => initFeedbacksMutation.mutate()}
                  disabled={initFeedbacksMutation.isPending}
                >
                  {initFeedbacksMutation.isPending
                    ? '初始化中…'
                    : '初始化 Feedbacks 索引'}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => initUsersMutation.mutate()}
                  disabled={initUsersMutation.isPending}
                >
                  {initUsersMutation.isPending
                    ? '初始化中…'
                    : '初始化 Users 索引'}
                </Button>
              </div>
              <Typography variant="caption" color="text.secondary">
                这些操作需要 Root 权限，且会访问后端 JWT
                鉴权，如果权限不足会返回 403。
              </Typography>
            </CardContent>
          </Card>

          {/* 全量同步 */}
          <Card className="shadow-sm">
            <CardHeader
              title="全量同步"
              subheader="将数据库中全部数据重新同步到 Meilisearch，一般在批量修改或者导入后使用。"
            />
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => syncBooksMutation.mutate()}
                  disabled={syncBooksMutation.isPending}
                >
                  {syncBooksMutation.isPending ? '同步中…' : '同步全部 Books'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => syncReadlistsMutation.mutate()}
                  disabled={syncReadlistsMutation.isPending}
                >
                  {syncReadlistsMutation.isPending
                    ? '同步中…'
                    : '同步全部 Readlists'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => syncUnitsMutation.mutate()}
                  disabled={syncUnitsMutation.isPending}
                >
                  {syncUnitsMutation.isPending ? '同步中…' : '同步全部 Units'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => syncFeedbacksMutation.mutate()}
                  disabled={syncFeedbacksMutation.isPending}
                >
                  {syncFeedbacksMutation.isPending
                    ? '同步中…'
                    : '同步全部 Feedbacks'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => syncUsersMutation.mutate()}
                  disabled={syncUsersMutation.isPending}
                >
                  {syncUsersMutation.isPending ? '同步中…' : '同步全部 Users'}
                </Button>
              </div>
              <Typography variant="caption" color="text.secondary">
                同步操作一般是异步任务，这里只展示任务已触发，具体进度在后端或
                Meili 仪表盘中查看。
              </Typography>
            </CardContent>
          </Card>

          {/* 危险操作 */}
          <Card className="shadow-sm md:col-span-2">
            <CardHeader
              title="危险操作"
              subheader="这些操作会直接影响搜索索引数据，请谨慎使用。"
            />
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  onClick={() => {
                    const ok = window.confirm(
                      '确定要删除 Meili 中的全部 Units 吗？这会清空相关搜索结果，且无法恢复！',
                    );
                    if (!ok) return;
                    deleteAllUnitsMutation.mutate();
                  }}
                  disabled={deleteAllUnitsMutation.isPending}
                >
                  {deleteAllUnitsMutation.isPending
                    ? '正在删除…'
                    : '删除全部 Units 索引数据'}
                </Button>
              </div>
              <Typography variant="caption" color="text.secondary">
                建议仅在开发 / 测试环境使用，生产环境前请确认已经做好数据备份。
              </Typography>
            </CardContent>
          </Card>
        </div>

        {/* Key 管理 */}
        <Card className="shadow-sm">
          <CardHeader
            title="Meili API Key 管理"
            subheader="创建前端 Search Key、临时 Admin Key，并查看 / 删除已有 Key。"
          />
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="contained"
                size="small"
                onClick={() => createSearchKeyMutation.mutate()}
                disabled={createSearchKeyMutation.isPending}
              >
                {createSearchKeyMutation.isPending
                  ? '正在创建…'
                  : '创建 Search Key'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="warning"
                onClick={() => createAdminKeyMutation.mutate()}
                disabled={createAdminKeyMutation.isPending}
              >
                {createAdminKeyMutation.isPending
                  ? '正在创建…'
                  : '创建 Admin Key'}
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => refetchKeys()}
                disabled={isKeysLoading}
              >
                刷新 Key 列表
              </Button>
            </div>

            {lastSearchKey && (
              <div className="text-xs break-all space-y-1">
                <div className="font-semibold">最新 Search Key：</div>
                <code className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
                  {lastSearchKey}
                </code>
              </div>
            )}

            {lastAdminKey && (
              <div className="text-xs break-all space-y-1">
                <div className="font-semibold text-amber-700">
                  最新 Admin Key（请妥善保存，只在安全环境使用）：
                </div>
                <code className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
                  {lastAdminKey}
                </code>
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              <Typography variant="subtitle2" className="mb-2">
                已有 Key 列表
              </Typography>
              {isKeysLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CircularProgress size={18} />
                  <span>正在加载 Key 列表...</span>
                </div>
              ) : !keyList || keyList.results.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  当前没有任何 Meili API Key。
                </Typography>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                      <tr>
                        <th className="py-1 pr-3">UID</th>
                        <th className="py-1 pr-3">名称</th>
                        <th className="py-1 pr-3">Actions</th>
                        <th className="py-1 pr-3">Indexes</th>
                        <th className="py-1 pr-3">过期时间</th>
                        <th className="py-1 pr-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keyList.results.map(key => (
                        <tr
                          key={key.uid}
                          className="border-b border-slate-100 dark:border-slate-800"
                        >
                          <td className="py-1 pr-3 align-top font-mono text-[11px]">
                            {key.uid}
                          </td>
                          <td className="py-1 pr-3 align-top text-[11px]">
                            {key.name || '-'}
                          </td>
                          <td className="py-1 pr-3 align-top text-[11px]">
                            {(key.actions || []).join(', ') || '-'}
                          </td>
                          <td className="py-1 pr-3 align-top text-[11px]">
                            {(key.indexes || []).join(', ') || '-'}
                          </td>
                          <td className="py-1 pr-3 align-top text-[11px]">
                            {key.expiresAt || '不过期'}
                          </td>
                          <td className="py-1 pr-3 align-top">
                            <Button
                              variant="text"
                              color="error"
                              size="small"
                              onClick={() => handleDeleteKey(key)}
                              disabled={deleteKeyMutation.isPending}
                            >
                              删除
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default MeiliPage;
