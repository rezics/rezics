import {broadcastQueryClient} from '@tanstack/query-broadcast-client-experimental';
import type {QueryClient} from '@tanstack/react-query';

/**
 * 同源多标签页同步（实验）
 * @param queryClient
 */
export function attachBroadcast(queryClient: QueryClient) {
  if (typeof window === 'undefined') return;
  broadcastQueryClient({
    queryClient,
    broadcastChannel: 'rq-bc', // 可自定义
  });
}
