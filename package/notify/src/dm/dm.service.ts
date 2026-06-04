import { and, desc, eq, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import { db } from "../db";
import {
  conversationBlocks,
  conversations,
  messages,
  type ConversationRow,
  type MessageRow,
} from "../db/schema";

function orderedParticipants(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function upsertConversation(
  userA: string,
  userB: string,
): Promise<string> {
  const [participantA, participantB] = orderedParticipants(userA, userB);
  const now = new Date();

  const [conversation] = await db
    .insert(conversations)
    .values({ participantA, participantB, updatedAt: now })
    .onConflictDoUpdate({
      target: [conversations.participantA, conversations.participantB],
      set: { updatedAt: now },
    })
    .returning({ id: conversations.id });
  if (!conversation) throw new Error("Conversation upsert returned no row");

  return conversation.id;
}

export async function insertMessage(
  conversationId: string,
  senderId: string,
  content: string,
): Promise<MessageRow> {
  return await db.transaction(async (tx) => {
    const [message] = await tx
      .insert(messages)
      .values({ conversationId, senderId, content })
      .returning();
    if (!message) throw new Error("Message insert returned no row");

    await tx
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    return message;
  });
}

export async function getConversations(
  userId: string,
): Promise<ConversationRow[]> {
  return await db
    .select()
    .from(conversations)
    .where(
      or(
        eq(conversations.participantA, userId),
        eq(conversations.participantB, userId),
      ),
    )
    .orderBy(desc(conversations.updatedAt));
}

async function getConversation(
  conversationId: string,
): Promise<ConversationRow | null> {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return conversation ?? null;
}

export async function getMessages(
  conversationId: string,
  userId: string,
  page: number,
  limit: number,
) {
  const conversation = await getConversation(conversationId);
  if (
    !conversation ||
    (conversation.participantA !== userId &&
      conversation.participantB !== userId)
  ) {
    return null;
  }

  const offset = (page - 1) * limit;
  const [messageRows, countRows] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .offset(offset)
      .limit(limit),
    db
      .select({ count: db.$count(messages) })
      .from(messages)
      .where(eq(messages.conversationId, conversationId)),
  ]);

  return {
    messages: messageRows,
    total: countRows[0]?.count ?? 0,
    page,
    limit,
  };
}

export async function markMessagesAsRead(
  conversationId: string,
  userId: string,
) {
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, userId),
        isNull(messages.readAt),
      ),
    );
}

async function isParticipant(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  return (await getPeerId(conversationId, userId)) !== null;
}

/** The other participant in a conversation, or null if `userId` isn't in it. */
export async function getPeerId(
  conversationId: string,
  userId: string,
): Promise<string | null> {
  const conversation = await getConversation(conversationId);
  if (!conversation) return null;
  if (conversation.participantA === userId) return conversation.participantB;
  if (conversation.participantB === userId) return conversation.participantA;
  return null;
}

/**
 * Mark the peer's messages up to (and including) `upToMessageId` as read for
 * `userId`. Returns the resulting read receipt, or `null` when `userId` is not
 * a participant or the target message is missing.
 */
export async function markReadUpTo(
  conversationId: string,
  userId: string,
  upToMessageId: string,
) {
  if (!(await isParticipant(conversationId, userId))) return null;

  const [target] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.id, upToMessageId),
        eq(messages.conversationId, conversationId),
      ),
    )
    .limit(1);
  if (!target) return null;

  const readAt = new Date();
  await db
    .update(messages)
    .set({ readAt })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, userId),
        isNull(messages.readAt),
        lte(messages.createdAt, target.createdAt),
      ),
    );

  return {
    conversationId,
    userId,
    lastReadMessageId: upToMessageId,
    readAt: readAt.toISOString(),
  };
}

/**
 * The peer's read state in a conversation: the latest message `userId` sent
 * that the peer has read. `lastReadMessageId` is null when the peer has read
 * nothing yet.
 */
export async function getReadReceipt(
  conversationId: string,
  userId: string,
  peerId: string,
) {
  const [lastRead] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.senderId, userId),
        isNotNull(messages.readAt),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);

  return {
    conversationId,
    userId: peerId,
    lastReadMessageId: lastRead?.id ?? null,
    readAt: (lastRead?.readAt ?? new Date()).toISOString(),
  };
}

/** Block or unblock a peer for `blockerId`. Returns the resulting block state. */
export async function setBlock(
  blockerId: string,
  blockedId: string,
  blocked: boolean,
) {
  if (blocked) {
    await db
      .insert(conversationBlocks)
      .values({ blockerId, blockedId })
      .onConflictDoNothing({
        target: [conversationBlocks.blockerId, conversationBlocks.blockedId],
      });
  } else {
    await db
      .delete(conversationBlocks)
      .where(
        and(
          eq(conversationBlocks.blockerId, blockerId),
          eq(conversationBlocks.blockedId, blockedId),
        ),
      );
  }
  return getBlockState(blockerId, blockedId);
}

async function findBlock(
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: conversationBlocks.id })
    .from(conversationBlocks)
    .where(
      and(
        eq(conversationBlocks.blockerId, blockerId),
        eq(conversationBlocks.blockedId, blockedId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Resolve the mutual block state between `userId` and `peerId`. */
export async function getBlockState(userId: string, peerId: string) {
  const [peerBlocked, blockedByPeer] = await Promise.all([
    findBlock(userId, peerId),
    findBlock(peerId, userId),
  ]);
  return {
    peerId,
    peerBlocked,
    blockedByPeer,
  };
}

/** True when either party has blocked the other. */
export async function isBlockedEitherWay(
  userId: string,
  peerId: string,
): Promise<boolean> {
  const state = await getBlockState(userId, peerId);
  return state.peerBlocked || state.blockedByPeer;
}

/**
 * Per-conversation viewer-facing summary fields: unread count (messages from
 * the peer not yet read) and mutual block flags.
 */
export async function getConversationViewerState(
  conversationId: string,
  userId: string,
  peerId: string,
) {
  const [unreadRows, blockState] = await Promise.all([
    db
      .select({ count: db.$count(messages) })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          ne(messages.senderId, userId),
          isNull(messages.readAt),
        ),
      ),
    getBlockState(userId, peerId),
  ]);
  return {
    unreadCount: unreadRows[0]?.count ?? 0,
    peerBlocked: blockState.peerBlocked,
    blockedByPeer: blockState.blockedByPeer,
  };
}
