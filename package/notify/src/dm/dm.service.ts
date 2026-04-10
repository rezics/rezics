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
