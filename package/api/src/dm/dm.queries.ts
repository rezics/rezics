import { queryOptions, useQuery } from "@tanstack/react-query";
import { dmApi } from "./dm.api";
import { dmKeys } from "./dm.keys";

export const dmConversationsQuery = () =>
  queryOptions({
    queryKey: dmKeys.conversations(),
    queryFn: () => dmApi.listConversations(),
    staleTime: 1000 * 30,
  });

export const dmConversationQuery = (id: string) =>
  queryOptions({
    queryKey: dmKeys.conversation(id),
    queryFn: () => dmApi.getConversation(id),
    enabled: !!id,
    staleTime: 1000 * 30,
  });

export const dmMessagesQuery = (
  conversationId: string,
  opts?: { cursor?: string; limit?: number },
) =>
  queryOptions({
    queryKey: [...dmKeys.messages(conversationId), opts ?? {}],
    queryFn: () => dmApi.listMessages(conversationId, opts),
    enabled: !!conversationId,
    staleTime: 1000 * 30,
  });

export function useConversations() {
  return useQuery(dmConversationsQuery());
}

export function useConversation(id: string) {
  return useQuery(dmConversationQuery(id));
}

export function useMessages(
  conversationId: string,
  opts?: { cursor?: string; limit?: number },
) {
  return useQuery(dmMessagesQuery(conversationId, opts));
}

export const dmBlockStateQuery = (peerId: string) =>
  queryOptions({
    queryKey: dmKeys.blockState(peerId),
    queryFn: () => dmApi.getBlockState(peerId),
    enabled: !!peerId,
    staleTime: 1000 * 30,
  });

export function useDmBlockState(peerId: string) {
  return useQuery(dmBlockStateQuery(peerId));
}

export const dmQueries = {
  conversations: dmConversationsQuery,
  conversation: dmConversationQuery,
  messages: dmMessagesQuery,
  blockState: dmBlockStateQuery,
};
