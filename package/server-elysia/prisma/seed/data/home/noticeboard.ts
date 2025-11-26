export const noticeboard = [
  {
    id: '1',
    title: '站点升级维护通知',
    content: '本周六 02:00-04:00 进行后端数据库升级，期间服务将短暂不可用。',
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
];

console.log(JSON.stringify(noticeboard, null, 2));
