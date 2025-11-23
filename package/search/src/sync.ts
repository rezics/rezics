import {PrismaClient} from '@package/server-elysia/prisma/generated/client';
import {addOrUpdateBooks} from './documents';

const prisma = new PrismaClient();

// TODO 引入 cursor 进行 千万级批量操作

export async function syncAllBooks() {
  const books = await prisma.book.findMany({
    include: {
      author: true,
      press: true,
      producer: true,
      unit: {
        include: {
          tags: true,
        },
      },
    },
  });

  const formatted = books.map(b => ({
    id: b.unitId,
    title: b.title,
    description: b.description,
    tags: b.unit.tags.map(t => t.name),
    authors: b.author.map(a => a.name),
    nsfw: b.unit.nsfw,
    authorIds: b.author.map(a => a.unitId),
    pressIds: b.press.map(p => p.unitId),
    producerIds: b.producer.map(p => p.unitId),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));

  return addOrUpdateBooks(formatted);
}
