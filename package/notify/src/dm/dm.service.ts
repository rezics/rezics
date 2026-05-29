import { prisma } from "#/prisma/client";

function orderedParticipants(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function upsertConversation(
  userA: string,
  userB: string,
): Promise<string> {
  const [participantA, participantB] = orderedParticipants(userA, userB);

  const conversation = await prisma.conversation.upsert({
    where: {
      participantA_participantB: { participantA, participantB },
    },
    update: { updatedAt: new Date() },
    create: { participantA, participantB },
  });

  return conversation.id;
}

export async function insertMessage(
  conversationId: string,
  senderId: string,
  content: string,
) {
  const message = await prisma.message.create({
    data: { conversationId, senderId, content },
  });

  // Touch conversation updatedAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return message;
}

export async function getConversations(userId: string) {
  return prisma.conversation.findMany({
    where: {
      OR: [{ participantA: userId }, { participantB: userId }],
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getMessages(
  conversationId: string,
  userId: string,
  page: number,
  limit: number,
) {
  // Verify participant
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (
    !conversation ||
    (conversation.participantA !== userId &&
      conversation.participantB !== userId)
  ) {
    return null;
  }

  const offset = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.message.count({ where: { conversationId } }),
  ]);

  return { messages, total, page, limit };
}

export async function markMessagesAsRead(
  conversationId: string,
  userId: string,
) {
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });
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
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
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

  const target = await prisma.message.findFirst({
    where: { id: upToMessageId, conversationId },
  });
  if (!target) return null;

  const readAt = new Date();
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      readAt: null,
      createdAt: { lte: target.createdAt },
    },
    data: { readAt },
  });

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
  const lastRead = await prisma.message.findFirst({
    where: { conversationId, senderId: userId, readAt: { not: null } },
    orderBy: { createdAt: "desc" },
  });
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
    await prisma.conversationBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });
  } else {
    await prisma.conversationBlock.deleteMany({
      where: { blockerId, blockedId },
    });
  }
  return getBlockState(blockerId, blockedId);
}

/** Resolve the mutual block state between `userId` and `peerId`. */
export async function getBlockState(userId: string, peerId: string) {
  const [peerBlocked, blockedByPeer] = await Promise.all([
    prisma.conversationBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: peerId } },
    }),
    prisma.conversationBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: peerId, blockedId: userId } },
    }),
  ]);
  return {
    peerId,
    peerBlocked: !!peerBlocked,
    blockedByPeer: !!blockedByPeer,
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
  const [unreadCount, blockState] = await Promise.all([
    prisma.message.count({
      where: { conversationId, senderId: { not: userId }, readAt: null },
    }),
    getBlockState(userId, peerId),
  ]);
  return {
    unreadCount,
    peerBlocked: blockState.peerBlocked,
    blockedByPeer: blockState.blockedByPeer,
  };
}
