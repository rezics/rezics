import { SWRConfiguration } from "swr";

import { apiPost } from "@/api/swr.ts";

export const swrOptions: SWRConfiguration = {
  // ---------------- 基础 ----------------
  // fetcher：默认数据抓取器，生产环境建议做错误检查，避免 500/404 被当作成功结果
  fetcher: apiPost,

  // ---------------- Revalidate 策略 ----------------
  // * 需要注意，SWR的插件显示的是缓存的读取时间，不是最新请求时间
  // 有缓存也会触发后台更新，保证数据新鲜
  revalidateIfStale: true,
  // 组件初次挂载时触发 revalidate，避免长时间显示旧数据
  revalidateOnMount: true,
  // 用户切回页面时自动刷新数据（典型场景：Tab 间切换）
  revalidateOnFocus: true,
  // 网络断开后恢复连接时自动刷新数据
  revalidateOnReconnect: true,
  // 相同 key 的请求在 3 秒内去重，避免重复请求
  dedupingInterval: 1000,
  // dedupingInterval: 10000,
  // 页面频繁切换焦点时，5 秒内只会 revalidate 一次
  focusThrottleInterval: 1000,
  // focusThrottleInterval: 15000,

  // ---------------- 刷新与轮询 ----------------
  // 默认不开启轮询；如果有实时数据需求，可以在单独 hook 配置
  refreshInterval: 0,
  // 不在后台 Tab 轮询，避免浪费资源
  refreshWhenHidden: false,
  // 离线时不做轮询，等待恢复后统一 revalidate
  refreshWhenOffline: false,

  // ---------------- 错误处理 ----------------
  // 请求错误时允许重试（配合 onErrorRetry）
  shouldRetryOnError: true,
  // 最多重试 3 次，避免死循环
  errorRetryCount: 3,
  // 每次错误后等待 5 秒再重试；低网速下自动延长
  errorRetryInterval: 5000,
  // 超过 3 秒未返回触发 onLoadingSlow 回调，可用于展示 skeleton 或提示用户
  loadingTimeout: 3000,

  // 请求过慢时的钩子，可做埋点或 UI 提示
  // @ts-expect-error - config is not used
  onLoadingSlow: (key, config) => {
    console.warn(`[SWR] 请求过慢: ${key}`);
  },

  // 请求成功时的钩子，常用于打点、日志
  // @ts-expect-error - config is not used
  onSuccess: (data, key, config) => {
    // console.log(`[SWR] 请求成功: ${key}`, data);
  },

  // 错误回调，可以接入 Sentry、Toast 等
  // @ts-expect-error - config is not used
  onError: (err, key, config) => {
    console.error(`[SWR] 请求失败: ${key}`, err);
  },

  // 自定义重试逻辑
  // @ts-expect-error - config is not used
  onErrorRetry: (err, key, config, revalidate, { retryCount }) => {
    if (err.status === 404) return; // 404 永远不重试
    if (retryCount >= 3) return; // 超过 3 次不再重试
    setTimeout(() => revalidate({ retryCount }), 5000);
  },

  // ---------------- 数据策略 ----------------
  // 单个 hook 初始数据，可用于 SSR 提前注水
  fallbackData: undefined,
  // key 变化时保留上一个数据直到新数据到达，减少页面抖动
  keepPreviousData: true,

  // 自定义对比函数：只有数据真正变化时才触发渲染
  compare: (a, b) => JSON.stringify(a) === JSON.stringify(b),
};
