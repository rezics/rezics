import React from 'react';
import {useTheme} from '@mui/material/styles';
import {
  Paper,
  Stack,
  Typography,
  Chip,
  Link as MLink,
  Divider,
  List,
  ListItemButton,
  Skeleton,
  Button,
} from '@mui/material';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';

type Notice = {
  id: string;
  title: string;
  content?: string;
  tag?: '公告' | '活动' | '更新';
  date: string; // ISO string
  link?: string;
  pin?: boolean;
};

async function fetchMockNotices(): Promise<Notice[]> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        {
          id: '1',
          title: '站点升级维护通知',
          content:
            '本周六 02:00-04:00 进行后端数据库升级，期间服务将短暂不可用。',
          tag: '公告',
          date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          pin: true,
        },
        {
          id: '2',
          title: '读书挑战赛开启！',
          content: '参与活动赢取周边礼品与会员权益，快来打卡吧～',
          tag: '活动',
          date: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
          link: '/events/reading-challenge',
        },
        {
          id: '3',
          title: '标签系统更新',
          content: '新增「主题/风格」维度标签，支持更精准的内容发现。',
          tag: '更新',
          date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        },
        {
          id: '4',
          title: '编辑精选上新',
          content: '查看本周编辑推荐书单，发现你的下一本心头好。',
          tag: '公告',
          date: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
          link: '/lists/editor-picks',
        },
      ]);
    }, 350);
  });
}

function formatRelative(dateIso: string): string {
  const ms = Date.now() - new Date(dateIso).getTime();
  const h = Math.floor(ms / 36e5);
  if (h < 1) return '刚刚';
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  const w = Math.floor(d / 7);
  return `${w} 周前`;
}

function TagBadge({tag}: {tag?: Notice['tag']}) {
  const theme = useTheme();
  const colorMap: Record<
    string,
    'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'default'
  > = {
    公告: 'info',
    活动: 'secondary',
    更新: 'success',
  };
  const color = (tag ? colorMap[tag] : 'default') as any;
  return (
    <Chip
      label={tag ?? '通知'}
      color={color}
      variant={color === 'default' ? 'outlined' : 'outlined'}
      size="small"
      sx={{
        borderRadius: theme.shape.borderRadius,
      }}
    />
  );
}

export type NoticeBoardProps = {
  initialNotices?: Notice[];
};

export const NoticeBoard: React.FC<NoticeBoardProps> = ({initialNotices}) => {
  const theme = useTheme();
  const [notices, setNotices] = React.useState<Notice[] | null>(
    initialNotices ?? null,
  );
  const [loading, setLoading] = React.useState<boolean>(!initialNotices);

  React.useEffect(() => {
    let mounted = true;
    if (!initialNotices) {
      fetchMockNotices().then(data => {
        if (mounted) {
          // Pinned first, then recent
          const sorted = [...data].sort((a, b) => {
            if (a.pin && !b.pin) return -1;
            if (!a.pin && b.pin) return 1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          });
          setNotices(sorted);
          setLoading(false);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [initialNotices]);

  return (
    <div>
      <div className="border-radius-2 overflow-hidden">
        {/* Header */}
        <div className="p-2 flex items-center justify-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <div
              className="w-8 h-8 inline-flex items-center justify-center rounded-[10px] shadow-sm"
              style={{
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
              }}
            >
              <NotificationsRoundedIcon className="w-5 h-5" />
            </div>
            <div>
              <Typography variant="caption" color="text.secondary">
                Notice
              </Typography>
              <Typography variant="subtitle1" fontWeight={600}>
                公告板
              </Typography>
            </div>
          </Stack>
          <MLink
            href="/notice"
            underline="hover"
            color="primary"
            variant="body2"
          >
            查看全部
          </MLink>
        </div>

        <Divider />

        {/* Content */}
        <div className="p-2">
          {loading && (
            <Stack spacing={1.2}>
              <Skeleton variant="rounded" height={18} />
              <Skeleton variant="rounded" height={18} />
              <Skeleton variant="rounded" height={18} />
              <Skeleton variant="rounded" height={18} />
            </Stack>
          )}

          {!loading && (!notices || notices.length === 0) && (
            <Typography variant="body2" color="text.secondary">
              暂无公告
            </Typography>
          )}

          {!loading && notices && notices.length > 0 && (
            <List
              dense
              disablePadding
              sx={{
                maxHeight: '100%',
                overflow: 'auto',
                pr: 0.5,
                '& .MuiListItemButton-root': {
                  borderRadius: 1.5,
                },
              }}
            >
              {notices.slice(0, 6).map(item => (
                <div key={item.id} className="mb-1">
                  <ListItemButton
                    component="a"
                    href={item.link ?? '#'}
                    sx={{
                      border: `1px solid ${theme.palette.divider}`,
                      bgcolor: theme.palette.background.paper,
                      transition: theme.transitions.create(
                        ['background-color', 'border-color'],
                        {
                          duration: theme.transitions.duration.shortest,
                        },
                      ),
                      '&:hover': {
                        borderColor: theme.palette.primary.light,
                        bgcolor:
                          theme.palette.mode === 'light'
                            ? theme.palette.primary[50] ??
                              'rgba(25,118,210,0.06)'
                            : 'rgba(25,118,210,0.12)',
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="flex-start"
                      sx={{width: '100%'}}
                    >
                      <Chip
                        label={item.pin ? '置顶' : '新'}
                        color={item.pin ? 'warning' : 'default'}
                        size="small"
                        variant={item.pin ? 'filled' : 'outlined'}
                        sx={{mt: 0.25}}
                      />
                      <div className="min-w-0 flex-1">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            noWrap
                            sx={{
                              color: 'text.primary',
                              flexShrink: 1,
                              minWidth: 0,
                            }}
                          >
                            {item.title}
                          </Typography>
                          <TagBadge tag={item.tag} />
                        </Stack>
                        {item.content && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mt: 0.5,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {item.content}
                          </Typography>
                        )}
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{mt: 0.5, display: 'block'}}
                        >
                          {formatRelative(item.date)}
                        </Typography>
                      </div>
                      <Typography
                        variant="body2"
                        color="text.disabled"
                        sx={{
                          ml: 0.5,
                          opacity: 0,
                          transition: theme.transitions.create('opacity', {
                            duration: theme.transitions.duration.shortest,
                          }),
                          '.MuiListItemButton-root:hover &': {opacity: 1},
                        }}
                      >
                        →
                      </Typography>
                    </Stack>
                  </ListItemButton>
                </div>
              ))}
            </List>
          )}
        </div>

        {/* Footer */}
        {/* <div className="px-2 pb-2 pt-1">
          <Button
            fullWidth
            href="/subscribe"
            variant="contained"
            color="primary"
            size="small"
          >
            订阅最新公告
          </Button>
        </div> */}
      </div>
    </div>
  );
};
