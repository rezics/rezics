import {useState, useEffect} from 'react';
import type React from 'react';
import {useTheme} from '@mui/material/styles';
import {
  Stack,
  Typography,
  Chip,
  Divider,
  List,
  ListItemButton,
  Skeleton,
} from '@mui/material';
import {RouterLink} from '../Common/RouterLink';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import {echoKvGetQuery} from '@/api/echokv/echokv';
import {useQuery} from '@tanstack/react-query';
import {useAlertStore} from '@/global/windowAlertStore';
import {parseEchoKVResponse} from '@/api/echokv/util';
import type {Theme} from '@mui/material/styles';

type Notice = {
  id: string;
  title: string;
  content?: string;
  tag?: '公告' | '活动' | '更新';
  date: string; // ISO string
  link?: string;
  pin?: boolean;
};

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

function NoticeBoardHeader({
  theme,
  className,
}: {
  theme: Theme;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: theme.palette.background.default,
      }}
    >
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
        <RouterLink
          href="/misc/notice"
          underline="hover"
          color="primary"
          variant="body2"
        >
          查看全部
        </RouterLink>
      </div>

      <Divider />
    </div>
  );
}

function NoticeBoardItem({item, theme}: {item: Notice; theme: Theme}) {
  return (
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
                ? theme.palette.primary[50] ?? 'rgba(25,118,210,0.06)'
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
            className={item.link ? 'visible' : 'invisible'}
          >
            →
          </Typography>
        </Stack>
      </ListItemButton>
    </div>
  );
}

export const NoticeBoard: React.FC = () => {
  const theme = useTheme();
  const {show: showAlert} = useAlertStore();
  const [notices, setNotices] = useState<Notice[]>([]);
  const {data, isLoading, error} = useQuery(echoKvGetQuery('home_notice'));

  useEffect(() => {
    try {
      setNotices(parseEchoKVResponse<Notice[]>(data));
    } catch (error) {
      showAlert(`公告板数据解析失败: ${error}`);
    }
  }, [data, showAlert]);

  if (error) {
    showAlert(`公告板数据加载失败: ${error}`);
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <NoticeBoardHeader
        theme={theme}
        className="sticky top-0 z-10 rounded-lg"
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-3 mt-3 p-2">
        {isLoading && (
          <Stack spacing={1.2}>
            <Skeleton variant="rounded" height={18} />
            <Skeleton variant="rounded" height={18} />
            <Skeleton variant="rounded" height={18} />
            <Skeleton variant="rounded" height={18} />
          </Stack>
        )}

        {!isLoading && (!notices || notices.length === 0) && (
          <Typography variant="body2" color="text.secondary">
            暂无公告
          </Typography>
        )}

        {!isLoading && notices && notices.length > 0 && (
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
            {notices?.map(item => (
              <NoticeBoardItem key={item.id} item={item} theme={theme} />
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
  );
};
